const express = require('express');
const passport = require('passport');
const authService = require('../services/authService');

const router = express.Router();

const setCookiesAndRespond = (res, tokens) => {
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  res.json({
    accessToken: tokens.accessToken,
    user: tokens.user
  });
};

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const tokens = await authService.registerWithEmail(username, email, password);
    setCookiesAndRespond(res, tokens);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const tokens = await authService.loginWithEmail(email, password);
    setCookiesAndRespond(res, tokens);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});

const providers = ['google', 'github', 'facebook', 'microsoft'];
const scopeMap = {
  google: ['profile', 'email'],
  github: ['user:email'],
  facebook: ['email'],
  microsoft: ['user.read']
};

providers.forEach(provider => {
  router.get(`/${provider}`, passport.authenticate(provider, { 
    session: false,
    scope: scopeMap[provider]
  }));
  
  router.get(`/${provider}/callback`, 
    (req, res, next) => {
      console.log(`[OAuth Callback] Provider: ${provider}, Code: ${req.query.code}, Time: ${Date.now()}`);
      next();
    },
    (req, res, next) => {
      passport.authenticate(provider, { session: false }, (err, user, info) => {
        if (err) {
          console.error(`[OAuth Error] Provider: ${provider}`);
          console.error(err);
          if (err.oauthError) console.error('[OAuth oauthError]', err.oauthError);
          if (err.body) console.error('[OAuth body]', err.body);
          if (err.internal) console.error('[OAuth internal]', err.internal);
          return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=oauth_failed`);
        }
        if (!user) {
          return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=oauth_failed`);
        }
        req.user = user;
        next();
      })(req, res, next);
    },
    (req, res) => {
      const tokens = authService.generateTokens(req.user);
      
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/?token=${tokens.accessToken}`);
    }
  );
});

module.exports = router;
