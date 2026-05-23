const GOOGLE_HOSTS = [
  'mail.google.com',
  'accounts.google.com',
  'google.com',
  'googleapis.com',
  'googleusercontent.com',
  'gstatic.com',
];

const FACEBOOK_HOSTS = [
  'facebook.com',
  'messenger.com',
  'fbcdn.net',
  'fbsbx.com',
];

const TWITTER_HOSTS = ['twitter.com', 'x.com', 't.co', 'twimg.com'];

const SLACK_HOSTS = [
  'slack.com',
  'app.slack.com',
  'slack-edge.com',
  'slack-imgs.com',
  'slackb.com',
  'slack-files.com',
];

const TRADINGVIEW_HOSTS = [        
  'tradingview.com',
  'sso.tradingview.com',
  ...FACEBOOK_HOSTS,
  ...TWITTER_HOSTS,
  ...GOOGLE_HOSTS
];

const SPOTIFY_HOSTS = [
  'open.spotify.com',
  'spotify.com',
  'spotifycdn.com',
  'spotifyads.com',
  ...FACEBOOK_HOSTS,
  ...TWITTER_HOSTS,
  ...GOOGLE_HOSTS,
]

export { 
  GOOGLE_HOSTS, 
  FACEBOOK_HOSTS, 
  TWITTER_HOSTS, 
  SLACK_HOSTS, 
  TRADINGVIEW_HOSTS, 
  SPOTIFY_HOSTS 
};
