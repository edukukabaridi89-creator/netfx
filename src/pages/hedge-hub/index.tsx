import React from 'react';
import './hedge-hub.scss';

const HedgeHub = () => {
    return (
        <div className='hedge-hub'>
            <div className='hedge-hub__header'>
                <div className='hedge-hub__header-icon'>
                    <svg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'>
                        <path d='M8 20 L20 8 L32 20' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' opacity='0.9' />
                        <path d='M8 20 L20 32 L32 20' stroke='currentColor' strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' opacity='0.5' />
                        <circle cx='20' cy='20' r='3' fill='currentColor' />
                    </svg>
                </div>
                <div>
                    <h1 className='hedge-hub__title'>Hedge Hub</h1>
                    <p className='hedge-hub__subtitle'>Protect your positions with automated hedging strategies</p>
                </div>
            </div>

            <div className='hedge-hub__coming-soon'>
                <div className='hedge-hub__coming-soon-badge'>Coming Soon</div>
                <h2>Smart Hedging Engine</h2>
                <p>
                    Automatically open opposing positions to protect against adverse market moves.
                    Define your hedge ratio, trigger conditions, and exit rules — the engine does the rest.
                </p>
            </div>

            <div className='hedge-hub__features'>
                <div className='hedge-hub__feature-card'>
                    <div className='hedge-hub__feature-icon'>🛡️</div>
                    <h3>Auto-Hedge</h3>
                    <p>Instantly open a counter-position when your primary trade moves against you by a set threshold.</p>
                </div>
                <div className='hedge-hub__feature-card'>
                    <div className='hedge-hub__feature-icon'>⚖️</div>
                    <h3>Ratio Control</h3>
                    <p>Choose your hedge ratio — full, partial, or dynamic — based on your risk tolerance.</p>
                </div>
                <div className='hedge-hub__feature-card'>
                    <div className='hedge-hub__feature-icon'>📉</div>
                    <h3>Loss Limiter</h3>
                    <p>Set maximum drawdown thresholds and let Hedge Hub automatically intervene to cap losses.</p>
                </div>
                <div className='hedge-hub__feature-card'>
                    <div className='hedge-hub__feature-icon'>🔔</div>
                    <h3>Alerts & Logs</h3>
                    <p>Get notified every time a hedge is triggered and review the full hedging history.</p>
                </div>
            </div>
        </div>
    );
};

export default HedgeHub;
