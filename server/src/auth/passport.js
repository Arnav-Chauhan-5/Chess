const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
// In a real implementation, we would query the DB using Prisma.
// const { PrismaClient } = require('@prisma/client');
// const prisma = new PrismaClient();

const authService = require('../services/authService');

const handleOAuthCallback = async (provider, profile, done) => {
  try {
    const { user } = await authService.handleOAuthLogin(provider, profile);
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
};

// Google Strategy
const googleId = process.env.GOOGLE_CLIENT_ID || 'missing_google_client_id';
const googleSecret = process.env.GOOGLE_CLIENT_SECRET || 'missing_google_secret';
console.log(`[OAuth] GoogleStrategy initialized with clientID: ${googleId === 'missing_google_client_id' ? 'MISSING' : googleId}`);
if (googleId === 'missing_google_client_id') {
  console.warn("WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Google OAuth will fail.");
}
passport.use(new GoogleStrategy({
  clientID: googleId,
  clientSecret: googleSecret,
  callbackURL: "/auth/google/callback"
}, (accessToken, refreshToken, profile, done) => {
  handleOAuthCallback('google', profile, done);
}));

// GitHub Strategy
const githubId = process.env.GITHUB_CLIENT_ID || 'missing_github_client_id';
const githubSecret = process.env.GITHUB_CLIENT_SECRET || 'missing_github_secret';
console.log(`[OAuth] GitHubStrategy initialized with clientID: ${githubId === 'missing_github_client_id' ? 'MISSING' : githubId}`);
if (githubId === 'missing_github_client_id') {
  console.warn("WARNING: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing. GitHub OAuth will fail.");
}
passport.use(new GitHubStrategy({
  clientID: githubId,
  clientSecret: githubSecret,
  callbackURL: "/auth/github/callback"
}, (accessToken, refreshToken, profile, done) => {
  handleOAuthCallback('github', profile, done);
}));

// Facebook Strategy
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "/auth/facebook/callback"
  }, (accessToken, refreshToken, profile, done) => {
    handleOAuthCallback('facebook', profile, done);
  }));
}

// Microsoft Strategy
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use(new MicrosoftStrategy({
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: "/auth/microsoft/callback",
    scope: ['user.read']
  }, (accessToken, refreshToken, profile, done) => {
    handleOAuthCallback('microsoft', profile, done);
  }));
}

module.exports = passport;
