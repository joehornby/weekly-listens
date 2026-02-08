export type LastFMUserGetTopArtistsResponse = Readonly<{
  topartists: {
    artist: Array<{
      streamable: 0 | 1;
      image: Array<{
        "#text": string;
        size: string;
      }>;
      mbid: string;
      url: string;
      playcount: string;
      "@attr": {
        rank: string;
      };
      name: string;
    }>;
    "@attr": {
      user: string;
      totalPages: string;
      page: string;
      perPage: string;
      total: string;
    };
  };
}>;

export type LastFMArtistGetInfoResponse = Readonly<{
  artist: {
    name: string;
    mbid: string;
    url: string;
    image: Array<{
      "#text": string;
      size: string;
    }>;
    streamable: 0 | 1;
    ontour: 0 | 1;
    stats: {
      listeners: string;
      playcount: string;
      userplaycount?: string;
    };
    similar: {
      artist: Array<{
        name: string;
        url: string;
        image: Array<{
          "#text": string;
          size: string;
        }>;
      }>;
    };
    tags: {
      tag: Array<{
        name: string;
        url: string;
      }>;
    };
    bio: {
      links: {
        link: {
          "#text": string;
          rel: string;
          href: string;
        };
      };
      published: string;
      summary: string;
      content: string;
    };
  };
}>;

export type LastFMUserGetWeeklyChartListResponse = Readonly<{
  weeklychartlist: {
    chart: Array<{
      from: string;
      to: string;
    }>;
    "@attr": {
      user: string;
    };
  };
}>;

export type LastFMUserGetWeeklyArtistChartResponse = Readonly<{
  weeklyartistchart: {
    artist:
      | Array<{
          mbid: string;
          playcount: string;
          url: string;
          name: string;
          "@attr"?: {
            rank: string;
          };
        }>
      | {
          mbid: string;
          playcount: string;
          url: string;
          name: string;
          "@attr"?: {
            rank: string;
          };
        };
    "@attr": {
      user: string;
      from: string;
      to: string;
    };
  };
}>;
