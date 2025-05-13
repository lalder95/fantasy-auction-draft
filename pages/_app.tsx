// pages/_app.tsx - Updated version
import '../styles/globals.css';
import type { AppProps } from 'next/app';
// Try both import options to see which one works with your Layout component
// Option 1: Default import
import Layout from '../components/shared/Layout';
// Option 2: Named import (uncomment if needed)
// import { Layout } from '../components/shared/Layout';

function MyApp({ Component, pageProps }: AppProps) {
  // For debugging, temporarily return just the Component without Layout
  // This will help identify if Layout is the issue
  return <Component {...pageProps} />;
  
  // Once the above works, uncomment this to use Layout again
  // return (
  //   <Layout>
  //     <Component {...pageProps} />
  //   </Layout>
  // );
}

export default MyApp;