import React from 'react';
import './bulk-trader.scss';

const BulkTrader = () => {
    return (
        <div className='bulk-trader'>
            <div className='bulk-trader__header'>
                <div className='bulk-trader__header-icon'>
                    <svg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'>
                        <rect x='4' y='10' width='32' height='6' rx='2' fill='currentColor' opacity='0.9' />
                        <rect x='4' y='20' width='32' height='6' rx='2' fill='currentColor' opacity='0.6' />
                        <rect x='4' y='30' width='32' height='6' rx='2' fill='currentColor' opacity='0.3' />
                    </svg>
                </div>
                <div>
                    <h1 className='bulk-trader__title'>Bulk Trader</h1>
                    <p className='bulk-trader__subtitle'>Execute multiple trades simultaneously across any market</p>
                </div>
            </div>

            <div className='bulk-trader__coming-soon'>
                <div className='bulk-trader__coming-soon-badge'>Coming Soon</div>
                <h2>Mass Trade Execution</h2>
                <p>
                    Place dozens of trades at once with a single click. Define your trade parameters once and
                    deploy them across multiple contracts, symbols, or stake amounts — all in parallel.
                </p>
            </div>

            <div className='bulk-trader__features'>
                <div className='bulk-trader__feature-card'>
                    <div className='bulk-trader__feature-icon'>⚡</div>
                    <h3>Simultaneous Entry</h3>
                    <p>Open multiple positions at the exact same time with zero delay between executions.</p>
                </div>
                <div className='bulk-trader__feature-card'>
                    <div className='bulk-trader__feature-icon'>🎯</div>
                    <h3>Custom Parameters</h3>
                    <p>Set individual stake, duration, and contract type per trade or apply a single config to all.</p>
                </div>
                <div className='bulk-trader__feature-card'>
                    <div className='bulk-trader__feature-icon'>📊</div>
                    <h3>Live Results</h3>
                    <p>Track all active bulk trades in a unified dashboard with real-time profit/loss monitoring.</p>
                </div>
                <div className='bulk-trader__feature-card'>
                    <div className='bulk-trader__feature-icon'>🔁</div>
                    <h3>Repeat & Schedule</h3>
                    <p>Save bulk trade templates and replay them on demand or on a scheduled interval.</p>
                </div>
            </div>
        </div>
    );
};

export default BulkTrader;
