import React from 'react';

const Card = ({ title, children, className = '', noPadding = false, headerAction, onClick, style }) => {
  return (
    <div
      className={`card ${className}`}
      style={{ padding: noPadding ? '0' : '1.5rem', display: 'flex', flexDirection: 'column', ...style }}
      onClick={onClick}
    >
      {title && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: noPadding ? '0' : '1.5rem',
          padding: noPadding ? '1.5rem 1.5rem 0' : '0'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>{title}</h3>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div style={{ flex: 1 }}>
        {children}
      </div>
    </div>
  );
};

export default Card;
