export interface FeaturedPlaylist {
  id: string;
  name: string;
  subtitle: string;
  image: string;
  query: string;
}

export const FEATURED_PLAYLISTS: FeaturedPlaylist[] = [
  {
    id: 'yt_bollywood_top_50',
    name: 'Bollywood Top 50',
    subtitle: 'Top Bollywood hits right now',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80',
    query: 'Top Bollywood Hindi Hits 2026'
  },
  {
    id: 'yt_trending_india',
    name: 'Trending India',
    subtitle: 'Viral and trending tracks in India',
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80',
    query: 'Trending Songs India 2026'
  },
  {
    id: 'yt_punjabi_hits',
    name: 'Punjabi Hits',
    subtitle: 'Hottest Punjabi beats & tracks',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&auto=format&fit=crop&q=80',
    query: 'Latest Punjabi Hits 2026'
  },
  {
    id: 'yt_romantic_melodies',
    name: 'Romantic Melodies',
    subtitle: 'Heart-touching Hindi romantic songs',
    image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&auto=format&fit=crop&q=80',
    query: 'Best Romantic Hindi Songs'
  },
  {
    id: 'yt_90s_evergreen',
    name: '90s Evergreen Bollywood',
    subtitle: 'Golden retro Hindi cinema hits',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=80',
    query: '90s Superhit Hindi Songs'
  },
  {
    id: 'yt_lofi_chill',
    name: 'Lofi Chill Bollywood',
    subtitle: 'Relaxing Hindi lofi & acoustic beats',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&auto=format&fit=crop&q=80',
    query: 'Bollywood Lofi Chill Songs'
  }
];
