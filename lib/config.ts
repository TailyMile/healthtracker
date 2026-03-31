function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string) {
  return process.env[name];
}

export const appConfig = {
  timezone: optional("APP_TIMEZONE") ?? "Europe/Moscow",
  userHeightCm: Number(optional("USER_HEIGHT") ?? "172"),
  userBike: optional("USER_BIKE") ?? "GT Avalanche Comp 2015",
  strava: {
    clientId: optional("STRAVA_CLIENT_ID"),
    clientSecret: optional("STRAVA_CLIENT_SECRET"),
    redirectUri: optional("STRAVA_REDIRECT_URI")
  },
  google: {
    clientId: optional("GOOGLE_CLIENT_ID"),
    clientSecret: optional("GOOGLE_CLIENT_SECRET"),
    redirectUri: optional("GOOGLE_REDIRECT_URI"),
    folderId: optional("GOOGLE_DRIVE_FOLDER_ID")
  },
  blob: {
    token: optional("BLOB_READ_WRITE_TOKEN"),
    statePath: optional("BLOB_STATE_PATH") ?? optional("BLOB_SQLITE_PATH") ?? "state/healthtracker.json"
  }
};

export function ensureStravaEnv() {
  return {
    clientId: required("STRAVA_CLIENT_ID"),
    clientSecret: required("STRAVA_CLIENT_SECRET"),
    redirectUri: required("STRAVA_REDIRECT_URI")
  };
}

export function ensureGoogleEnv() {
  return {
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
    redirectUri: required("GOOGLE_REDIRECT_URI"),
    folderId: required("GOOGLE_DRIVE_FOLDER_ID")
  };
}
