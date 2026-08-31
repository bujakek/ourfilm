import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function GalleryPage({ params }: Props) {
  const { slug } = await params
  redirect(`/e/${slug}`)
}
