interface PersonalData {
  [key: string]: string | string[];
}

interface SocialConfig {
  label: string;
  urlTemplate: string;
  icon: string;
}

const SOCIAL_CONFIG: Record<string, SocialConfig> = {
  github: { label: 'GitHub', urlTemplate: 'https://github.com/{v}', icon: 'github' },
  linkedin: {
    label: 'LinkedIn',
    urlTemplate: 'https://linkedin.com/in/{v}',
    icon: 'linkedin',
  },
  gitlab: { label: 'GitLab', urlTemplate: 'https://gitlab.com/{v}', icon: 'gitlab' },
  twitter: { label: 'X (Twitter)', urlTemplate: 'https://x.com/{v}', icon: 'twitter' },
  instagram: {
    label: 'Instagram',
    urlTemplate: 'https://instagram.com/{v}',
    icon: 'instagram',
  },
  youtube: {
    label: 'YouTube',
    urlTemplate: 'https://youtube.com/@{v}',
    icon: 'youtube',
  },
  tiktok: {
    label: 'TikTok',
    urlTemplate: 'https://tiktok.com/@{v}',
    icon: 'tiktok',
  },
  twitch: { label: 'Twitch', urlTemplate: 'https://twitch.tv/{v}', icon: 'twitch' },
  telegram: { label: 'Telegram', urlTemplate: 'https://t.me/{v}', icon: 'telegram' },
  signal: { label: 'Signal', urlTemplate: 'https://signal.me/#p/{v}', icon: 'signal' },
  blog: { label: 'Blog', urlTemplate: '{v}', icon: 'rss' },
  reddit: { label: 'Reddit', urlTemplate: 'https://reddit.com/u/{v}', icon: 'reddit' },
  hackernews: {
    label: 'Hacker News',
    urlTemplate: 'https://news.ycombinator.com/user?id={v}',
    icon: 'ycombinator',
  },
  lobsters: {
    label: 'Lobsters',
    urlTemplate: 'https://lobste.rs/u/{v}',
    icon: 'lobsters',
  },
  discogs: {
    label: 'Discogs',
    urlTemplate: 'https://www.discogs.com/user/{v}',
    icon: 'discogs',
  },
  codepen: {
    label: 'CodePen',
    urlTemplate: 'https://codepen.io/{v}',
    icon: 'codepen',
  },
  jsfiddle: {
    label: 'JSFiddle',
    urlTemplate: 'https://jsfiddle.net/{v}',
    icon: 'jsfiddle',
  },
  facebook: {
    label: 'Facebook',
    urlTemplate: 'https://facebook.com/{v}',
    icon: 'facebook',
  },
};

const DISPLAY_ORDER = [
  'github',
  'linkedin',
  'gitlab',
  'twitter',
  'instagram',
  'youtube',
  'tiktok',
  'twitch',
  'telegram',
  'signal',
  'blog',
  'reddit',
  'hackernews',
  'lobsters',
  'discogs',
  'codepen',
  'jsfiddle',
  'facebook',
];

export interface SocialLink {
  key: string;
  label: string;
  url: string;
  icon: string;
}

export function getSocialLinks(personal: PersonalData, filterKeys?: string[]): SocialLink[] {
  const order = filterKeys ?? DISPLAY_ORDER;
  return order
    .filter((key) => {
      const val = personal[key];
      return typeof val === 'string' && val.trim() !== '' && SOCIAL_CONFIG[key];
    })
    .map((key) => {
      const config = SOCIAL_CONFIG[key];
      const handle = personal[key] as string;
      return {
        key,
        label: config.label,
        url: config.urlTemplate.replace('{v}', handle),
        icon: config.icon,
      };
    });
}