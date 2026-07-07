import React from 'react';
import './speed-lab.scss';

const SpeedLab = () => {
    return (
        <div className='speed-lab'>
            <div className='speed-lab__header'>
                <div className='speed-lab__header-icon'>
                    <svg width='40' height='40' viewBox='0 0 40 40' fill='none' xmlns='http://www.w3.org/2000/svg'>
                        <path d='M20 6 L14 22 L20 19 L20 34 L26 18 L20 21 Z' fill='currentColor' opacity='0.9' />
                    </svg>
                </div>
                <div>
                    <h1 className='speed-lab__title'>Speed Lab</h1>
                    <p className='speed-lab__subtitle'>Test and benchmark your strategies at maximum execution speed</p>
                </div>
            </div>

            <div className='speed-lab__coming-soon'>
                <div className='speed-lab__coming-soon-badge'>Coming Soon</div>
                <h2>Ultra-Fast Strategy Testing</h2>
                <p>
                    Run your bot strategies through thousands of simulated ticks in seconds.
                    Measure latency, throughput, and win-rate under different market conditions before going live.
                </p>
            </div>

            <div className='speed-lab__features'>
                <div className='speed-lab__feature-card'>
                    <div className='speed-lab__feature-icon'>🚀</div>
                    <h3>Turbo Backtest</h3>
                    <p>Replay months of historical tick data in under a minute to stress-test your strategy.</p>
                </div>
                <div className='speed-lab__feature-card'>
                    <div className='speed-lab__feature-icon'>⏱️</div>
                    <h3>Latency Profiler</h3>
                    <p>Measure end-to-end execution time from signal generation to trade confirmation.</p>
                </div>
                <div className='speed-lab__feature-card'>
                    <div className='speed-lab__feature-icon'>📈</div>
                    <h3>Performance Report</h3>
                    <p>Get detailed reports: win rate, avg profit per trade, max drawdown, and execution speed.</p>
                </div>
                <div className='speed-lab__feature-card'>
                    <div className='speed-lab__feature-icon'>🧪</div>
                    <h3>A/B Testing</h3>
                    <p>Compare two strategy variants head-to-head on the same data to find the optimal config.</p>
                </div>
            </div>
        </div>
    );
};

export default SpeedLab;
