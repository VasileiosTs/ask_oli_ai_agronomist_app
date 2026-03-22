/** @jsxImportSource react */
import { ImageResponse } from '@vercel/og';
import React from 'react';
export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const SEVERITY_COLOR: Record<string, string> = {
  low: '#2EA043',
  medium: '#D97706',
  high: '#DC2626',
};

const SEVERITY_LABEL: Record<string, string> = {
  low: 'Χαμηλή',
  medium: 'Μέτρια',
  high: 'Υψηλή',
};

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const shareId = url.pathname.split('/').pop();

    if (!shareId) {
      return new Response('Missing shareId', { status: 400 });
    }

    // Fetch diagnosis from Supabase
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/safe_shared_diagnoses?share_id=eq.${shareId}&select=*`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    const rows = await res.json();
    const data = rows?.[0];

    const crop = data?.crop_type || 'Καλλιέργεια';
    const problem = data?.problem || data?.diagnosis || 'Πρόβλημα';
    const cause = data?.cause || '';
    const product = data?.product_applied || data?.product || '';
    const severity = data?.severity as string | null;
    const organic: string[] = Array.isArray(data?.organic_treatments) ? data.organic_treatments : [];
    const chemical: string[] = Array.isArray(data?.chemical_treatments) ? data.chemical_treatments : [];
    const sevColor = severity ? (SEVERITY_COLOR[severity] || '#2EA043') : '#2EA043';
    const sevLabel = severity ? (SEVERITY_LABEL[severity] || '') : '';

    return new ImageResponse(
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#080C10',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Background radial glow */}
        <div style={{
          position: 'absolute',
          top: '-150px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '800px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(46,160,67,0.12) 0%, transparent 65%)',
          display: 'flex',
        }} />

        {/* Left accent bar */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '4px',
          background: 'linear-gradient(180deg, transparent, #2EA043, transparent)',
          display: 'flex',
        }} />

        {/* Content */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '52px 64px',
          height: '100%',
          gap: '0px',
        }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '36px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Four-petal logo */}
              <svg width="32" height="32" viewBox="0 0 32 32">
                <ellipse cx="16" cy="7"  rx="7" ry="10" fill="#2D6A4F"/>
                <ellipse cx="16" cy="25" rx="7" ry="10" fill="#2D6A4F"/>
                <ellipse cx="7"  cy="16" rx="10" ry="7" fill="#2EA043"/>
                <ellipse cx="25" cy="16" rx="10" ry="7" fill="#2EA043"/>
                <circle  cx="16" cy="16" r="5"  fill="#080C10"/>
              </svg>
              <span style={{ color: '#2EA043', fontSize: '16px', letterSpacing: '0.15em', fontWeight: 500 }}>
                OLI · AI ΓΕΩΠΟΝΟΣ
              </span>
            </div>
            {sevLabel && (
              <div style={{
                background: `${sevColor}18`,
                border: `1px solid ${sevColor}50`,
                borderRadius: '999px',
                padding: '6px 16px',
                color: sevColor,
                fontSize: '13px',
                fontWeight: 500,
                display: 'flex',
              }}>
                {sevLabel} σοβαρότητα
              </div>
            )}
          </div>

          {/* Crop label */}
          <div style={{
            color: '#2EA043',
            fontSize: '14px',
            letterSpacing: '0.2em',
            fontWeight: 500,
            marginBottom: '10px',
            display: 'flex',
          }}>
            {crop.toUpperCase()}
          </div>

          {/* Problem — big display text */}
          <div style={{
            color: '#FFFFFF',
            fontSize: problem.length > 40 ? '44px' : '54px',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            marginBottom: '16px',
            display: 'flex',
            maxWidth: '700px',
          }}>
            {problem}
          </div>

          {/* Cause */}
          {cause && (
            <div style={{
              color: 'rgba(232,237,242,0.5)',
              fontSize: '20px',
              marginBottom: '28px',
              display: 'flex',
            }}>
              Αιτία: {cause}
            </div>
          )}

          {/* Treatment pills */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: 'auto' }}>
            {organic.slice(0, 2).map((t, i) => (
              <div key={i} style={{
                background: 'rgba(46,160,67,0.08)',
                border: '1px solid rgba(46,160,67,0.25)',
                borderRadius: '12px',
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ color: '#2EA043', fontSize: '14px' }}>🌿</span>
                <span style={{ color: 'rgba(232,237,242,0.75)', fontSize: '14px' }}>{t}</span>
              </div>
            ))}
            {chemical.slice(0, 1).map((t, i) => (
              <div key={i} style={{
                background: 'rgba(96,165,250,0.06)',
                border: '1px solid rgba(96,165,250,0.2)',
                borderRadius: '12px',
                padding: '10px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ color: '#60A5FA', fontSize: '14px' }}>⚗️</span>
                <span style={{ color: 'rgba(232,237,242,0.75)', fontSize: '14px' }}>{t}</span>
              </div>
            ))}
            {!organic.length && !chemical.length && product && (
              <div style={{
                background: 'rgba(46,160,67,0.08)',
                border: '1px solid rgba(46,160,67,0.25)',
                borderRadius: '12px',
                padding: '10px 18px',
                color: 'rgba(232,237,242,0.75)',
                fontSize: '14px',
                display: 'flex',
              }}>
                {product}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: '20px',
            marginTop: '24px',
          }}>
            <div style={{ color: 'rgba(232,237,242,0.3)', fontSize: '14px', display: 'flex' }}>
              Διαγνώστηκε με Oli · askoli.app
            </div>
            <div style={{
              background: '#2EA043',
              borderRadius: '999px',
              padding: '8px 20px',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
            }}>
              Δες τη διάγνωση →
            </div>
          </div>

        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err) {
    console.error('OG image error:', err);
    // Fallback: generic Oli card
    return new ImageResponse(
      <div style={{
        width: '1200px', height: '630px',
        background: '#080C10', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px',
      }}>
        <div style={{ color: '#2EA043', fontSize: '32px', fontWeight: 700 }}>Oli</div>
        <div style={{ color: 'rgba(232,237,242,0.5)', fontSize: '18px' }}>AI Γεωπόνος</div>
      </div>,
      { width: 1200, height: 630 }
    );
  }
}
