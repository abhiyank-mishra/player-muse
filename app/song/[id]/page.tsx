import { Metadata, ResolvingMetadata } from 'next';
import { getYouTubeSongById } from '@/app/api/music/song/[id]/route';
import SongPageClient from './ClientComponent';

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
  props: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const params = await props.params;

  const song = await getYouTubeSongById(params.id);

  if (!song) {
    return { title: 'Song Not Found - Muse' };
  }

  const rawImage = Array.isArray(song.image) ? (song.image[2] || song.image[0]) : song.image;
  const FALLBACK_OG = 'https://muse.abhiyank.in/og-image.png';
  const imageUrl = (rawImage && typeof rawImage === 'string' && rawImage.trim() !== '') ? rawImage : FALLBACK_OG;

  const songTitle = song.name || 'Unknown Song';
  const artistName = song.artist || 'Unknown Artist';
  const description = `Listen to ${songTitle} by ${artistName} on Muse — Premium Ad-Free Music.`;
  const pageUrl = `https://muse.abhiyank.in/song/${params.id}`;

  return {
    title: `${songTitle} - ${artistName} | Muse`,
    description,
    openGraph: {
      title: `${songTitle} — ${artistName}`,
      description,
      url: pageUrl,
      siteName: 'Muse Music',
      type: 'music.song',
      images: [{
        url: imageUrl,
        width: 500,
        height: 500,
        alt: `${songTitle} by ${artistName}`,
        type: 'image/jpeg',
      }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${songTitle} — ${artistName}`,
      description: `Listen ad-free on Muse.`,
      images: [{
        url: imageUrl,
        width: 500,
        height: 500,
        alt: `${songTitle} by ${artistName}`,
      }],
    },
  };
}

export default async function Page(props: Props) {
  const params = await props.params;
  const song = await getYouTubeSongById(params.id);

  return <SongPageClient song={song} />;
}
