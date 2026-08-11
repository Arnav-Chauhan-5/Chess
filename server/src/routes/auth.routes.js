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
    passport.authenticate(provider, { session: false, failureRedirect: '/login?error=oauth_failed' }),
    (req, res) => {
      // Because we used authService in the passport strategy, req.user already contains the DB user object.
      // We just need to generate the tokens for it here since passport handles the auth flow.
      const tokens = authService.generateTokens(req.user);
      
      // Set the refresh token cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      // Redirect back to frontend with the access token in URL fragment or query parameter (less secure, fragment is better)
      // or we can just redirect to a success page that posts a message to the opener.
      // For MVP, a simple redirect with access token in query param.
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/?token=${tokens.accessToken}`);
    }
  );
});

module.exports = router;
