import '../styles/globals.css'
import Head from 'next/head'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.ico" sizes="any"/>
        <link rel="icon" href="/icon.svg" type="image/svg+xml"/>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
        <meta name="theme-color" content="#1F3A52"/>
        <meta name="mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-capable" content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <meta name="apple-mobile-web-app-title" content="PostScout"/>
        <link rel="manifest" href="/manifest.json"/>
      </Head>
      <Component {...pageProps}/>
    </>
  )
}
