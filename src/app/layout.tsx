const css = (s: TemplateStringsArray) => s.join("");

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  // below are some basic styles similar to the Worknice app look and feel
  <html lang="en">
    <head>
      <link
        rel="stylesheet"
        href="https://unpkg.com/@worknice/whiteboard@0.0.2/dist/shared.css"
      />
      <style>
        {css`
        body {
          color: oklch(0.3886, 0.0206, 259.7);
          font-family: -apple-system, "system-ui", "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
          font-style: normal;
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
           }
          .Container {
            display: grid;
            justify-content: center;
            grid-template-columns: minmax(auto, 800px);
          }
                  
          h1 {
          font-weight: 600;
          font-size: 30px;
          line-height: 45px;
          }
          h2,
          label,
          button,
          input,
          select {
            all: revert;
          }

          .Card {
            background: #FFFFFF;
            border-radius: 8px;
            padding: 10px 20px 20px 20px;
            width: 100%;
            max-width: 100%;
            margin: 20px auto; 
            border: 1px solid #E0E0E0;
        }
    
        .Card th, .Card td {
            padding: 10px;
            text-align: left;
        }
    
        .Card th {
            font-size: 20px;
        }
    
        .wn-input {
            width: 100%;
            padding: 8px 32px 8px 12px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
    
        .wn-button--primary {
            background-color: #7C005B;
            color: #ffffff;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.3s;
            float: right;
        }
    
        .wn-button--primary:hover {
            background-color: #90116E;
        }
        .back-button {
          width: auto;
          display: inline-flex;
          align-items: center;
          background-color: #FCFCFE; /* Accent color */
          padding: 8px 12px 8px 6px;
          font-size: 15px;
          font-weight: 400;
          border: 1px solid #d3d3d3;
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.3s ease;
          position: absolute;
          top: 20px;
          left: 20px;
          }
          
        
        .back-button:hover {
          background-color: #E2E2E5; /* Darker accent for hover */
        }
        
        .back-icon {
          width: 20px;
          height: 14px;
          margin-right: 6px;
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='15 18 9 12 15 6'%3E%3C/polyline%3E%3C/svg%3E") no-repeat left 0px center;
          background-size: 22px 22px;
        }
        `}
      </style>
    </head>
    <body>{children}</body>
  </html>
);

export default RootLayout;
