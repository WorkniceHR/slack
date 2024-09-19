const css = (s: TemplateStringsArray) => s.join("");

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  <html lang="en">
    <head>
      <link
        rel="stylesheet"
        href="https://unpkg.com/@worknice/whiteboard@0.0.2/dist/shared.css"
      />
      <style>
        {css`
          .Container {
            display: grid;
            justify-content: center;
            grid-template-columns: minmax(auto, 600px);
          }
          .Card {
            background: white;
            padding: 1em;
            border-radius: 10px;
          }
          h1,
          h2,
          label,
          button,
          input,
          select {
            all: revert;
          }
        `}
      </style>
    </head>
    <body>{children}</body>
  </html>
);

export default RootLayout;
