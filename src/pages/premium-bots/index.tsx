// @ts-nocheck
import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import './premium-bots.scss';

const PREMIUM_BOTS = [
    {
        id: 'even-odd-martingale',
        name: 'Even/Odd Martingale',
        category: 'Volatility',
        description: 'Trades Even/Odd on Volatility indices with a martingale recovery strategy. Uses digit analysis to find bias before entering.',
        markets: ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'],
        defaultMarket: 'R_50',
        defaultStake: '1.00',
        martingale: '2.2',
        tradeType: 'DIGITEVEN',
        risk: 'Medium',
        winRate: '~55%',
        icon: '📈',
        badge: 'Popular',
    },
    {
        id: 'over-under-smart',
        name: 'Over/Under Smart Entry',
        category: 'Volatility 1s',
        description: 'Analyzes real-time digit frequency to detect when a digit threshold is likely to be crossed. Waits for 3 consecutive signals before entering.',
        markets: ['1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V'],
        defaultMarket: '1HZ10V',
        defaultStake: '0.50',
        martingale: '2.2',
        tradeType: 'DIGITOVER',
        risk: 'Low',
        winRate: '~58%',
        icon: '🎯',
        badge: 'Recommended',
    },
    {
        id: 'boom-crash-rider',
        name: 'Boom/Crash Spike Rider',
        category: 'Boom/Crash',
        description: 'Specifically designed for Boom and Crash markets. Detects pre-spike conditions and positions accordingly for high-profit spike entries.',
        markets: ['BOOM500', 'BOOM1000', 'CRASH500', 'CRASH1000'],
        defaultMarket: 'BOOM500',
        defaultStake: '1.00',
        martingale: '2.0',
        tradeType: 'CALL',
        risk: 'High',
        winRate: '~62%',
        icon: '💥',
        badge: 'Hot',
    },
    {
        id: 'matches-differs-analyzer',
        name: 'Matches/Differs Analyzer',
        category: 'Volatility',
        description: 'Identifies the least frequent digit over the last 50 ticks and trades "Differs" against it, or the most frequent and trades "Matches". Adapts automatically.',
        markets: ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'],
        defaultMarket: 'R_10',
        defaultStake: '0.35',
        martingale: '2.5',
        tradeType: 'DIGITMATCH',
        risk: 'Low',
        winRate: '~60%',
        icon: '🔍',
        badge: 'Safe',
    },
    {
        id: 'step-index-scalper',
        name: 'Step Index Scalper',
        category: 'Step',
        description: 'Optimized for Step Index which moves in fixed increments. Detects directional momentum and scalps small but consistent profits on each step.',
        markets: ['stpRNG'],
        defaultMarket: 'stpRNG',
        defaultStake: '1.00',
        martingale: '2.2',
        tradeType: 'CALL',
        risk: 'Medium',
        winRate: '~54%',
        icon: '📊',
        badge: 'Consistent',
    },
    {
        id: 'jump-index-momentum',
        name: 'Jump Index Momentum',
        category: 'Jump',
        description: 'Captures high-volatility jump movements on Jump indices. Uses trend continuation logic to ride post-jump momentum for maximum pips.',
        markets: ['JD10', 'JD25', 'JD50', 'JD75', 'JD100'],
        defaultMarket: 'JD25',
        defaultStake: '1.00',
        martingale: '2.2',
        tradeType: 'CALL',
        risk: 'High',
        winRate: '~57%',
        icon: '🚀',
        badge: 'Advanced',
    },
];

const RISK_COLOR: Record<string, string> = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' };

const PremiumBots = observer(({ handleTabChange }: { handleTabChange: (tab: number) => void }) => {
    const { dashboard } = useStore();
    const [loadedBot, setLoadedBot] = useState<string | null>(null);
    const [customStake, setCustomStake] = useState<Record<string, string>>({});
    const [customMartingale, setCustomMartingale] = useState<Record<string, string>>({});
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [runningBot, setRunningBot] = useState<string | null>(null);

    const categories = ['All', ...Array.from(new Set(PREMIUM_BOTS.map(b => b.category)))];
    const filteredBots = selectedCategory === 'All'
        ? PREMIUM_BOTS
        : PREMIUM_BOTS.filter(b => b.category === selectedCategory);

    const handleLoadBot = (bot: typeof PREMIUM_BOTS[0]) => {
        setLoadedBot(bot.id);
        setRunningBot(null);
        setTimeout(() => {
            dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
            if (handleTabChange) handleTabChange(DBOT_TABS.BOT_BUILDER);
        }, 800);
    };

    const getStake = (bot: typeof PREMIUM_BOTS[0]) =>
        customStake[bot.id] ?? bot.defaultStake;

    const getMartingale = (bot: typeof PREMIUM_BOTS[0]) =>
        customMartingale[bot.id] ?? bot.martingale;

    return (
        <div className='premium-bots'>
            <div className='premium-bots__header'>
                <div className='premium-bots__title'>
                    <span className='premium-bots__title-icon'>💎</span>
                    <div>
                        <h1>Free Premium Bots</h1>
                        <p>Professional trading bots — ready to run, zero cost</p>
                    </div>
                </div>
                <div className='premium-bots__stats'>
                    <div className='premium-bots__stat'>
                        <span className='premium-bots__stat-num'>{PREMIUM_BOTS.length}</span>
                        <span className='premium-bots__stat-label'>Bots Available</span>
                    </div>
                    <div className='premium-bots__stat'>
                        <span className='premium-bots__stat-num'>Free</span>
                        <span className='premium-bots__stat-label'>Forever</span>
                    </div>
                </div>
            </div>

            <div className='premium-bots__category-tabs'>
                {categories.map(cat => (
                    <button
                        key={cat}
                        className={`premium-bots__cat-tab ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className='premium-bots__grid'>
                {filteredBots.map(bot => {
                    const isLoaded = loadedBot === bot.id;
                    return (
                        <div key={bot.id} className={`premium-bots__card ${isLoaded ? 'loaded' : ''}`}>
                            <div className='premium-bots__card-header'>
                                <div className='premium-bots__card-icon'>{bot.icon}</div>
                                <div className='premium-bots__card-meta'>
                                    <h3>{bot.name}</h3>
                                    <div className='premium-bots__badges'>
                                        <span className='premium-bots__badge premium-bots__badge--category'>{bot.category}</span>
                                        <span className='premium-bots__badge premium-bots__badge--type'>{bot.badge}</span>
                                    </div>
                                </div>
                            </div>

                            <p className='premium-bots__description'>{bot.description}</p>

                            <div className='premium-bots__info-row'>
                                <div className='premium-bots__info-item'>
                                    <span className='premium-bots__info-label'>Win Rate</span>
                                    <span className='premium-bots__info-value'>{bot.winRate}</span>
                                </div>
                                <div className='premium-bots__info-item'>
                                    <span className='premium-bots__info-label'>Risk Level</span>
                                    <span className='premium-bots__info-value' style={{ color: RISK_COLOR[bot.risk] }}>
                                        ● {bot.risk}
                                    </span>
                                </div>
                                <div className='premium-bots__info-item'>
                                    <span className='premium-bots__info-label'>Trade Type</span>
                                    <span className='premium-bots__info-value'>{bot.tradeType}</span>
                                </div>
                            </div>

                            <div className='premium-bots__params'>
                                <div className='premium-bots__param'>
                                    <label>Stake ($)</label>
                                    <input
                                        type='number'
                                        value={getStake(bot)}
                                        onChange={e => setCustomStake(prev => ({ ...prev, [bot.id]: e.target.value }))}
                                        min='0.35'
                                        step='0.01'
                                    />
                                </div>
                                <div className='premium-bots__param'>
                                    <label>Martingale</label>
                                    <input
                                        type='number'
                                        value={getMartingale(bot)}
                                        onChange={e => setCustomMartingale(prev => ({ ...prev, [bot.id]: e.target.value }))}
                                        min='1'
                                        step='0.1'
                                    />
                                </div>
                            </div>

                            <div className='premium-bots__markets'>
                                <span className='premium-bots__markets-label'>Markets:</span>
                                {bot.markets.slice(0, 3).map(m => (
                                    <span key={m} className='premium-bots__market-tag'>{m}</span>
                                ))}
                                {bot.markets.length > 3 && (
                                    <span className='premium-bots__market-tag'>+{bot.markets.length - 3}</span>
                                )}
                            </div>

                            <button
                                className={`premium-bots__load-btn ${isLoaded ? 'loaded' : ''}`}
                                onClick={() => handleLoadBot(bot)}
                            >
                                {isLoaded ? '✅ Loading Bot Builder...' : '🤖 Load Bot'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

export default PremiumBots;
