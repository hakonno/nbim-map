// The explore homepage owns a @modal parallel slot so that /property/[id]
// links clicked inside the app are intercepted and rendered as an in-context
// detail panel over the live map, while the URL becomes the property's real,
// shareable address. Hard loads of the same URL render the full static page
// under app/(content) instead.
export default function ExploreLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
