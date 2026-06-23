// @ts-nocheck
import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { load } from '@/external/bot-skeleton';
import { DBOT_TABS } from '@/constants/bot-contents';
import './premium-bots.scss';

const PREMIUM_BOTS = [
    {
        id: 'dollar-hunter-bot',
        name: '$DOLLAR HUNTER BOT',
        fileName: 'dollar-hunter-bot.xml',
        category: 'Volatility',
        description: 'Hunts dollar opportunities on Volatility 100. Uses Over/Under digit logic with martingale recovery and auto target-profit stop.',
        markets: ['R_100'],
        defaultStake: '0.35',
        martingale: '2.2',
        tradeType: 'DIGITOVER',
        risk: 'Medium',
        winRate: '~56%',
        icon: '💵',
        badge: 'Popular',
    },
    {
        id: 'original-2025-version',
        name: '2025 Original Version',
        fileName: 'original-2025-version.xml',
        category: 'Volatility',
        description: 'The classic 2025 original bot strategy for Volatility 100. Battle-tested Over/Under logic with built-in loss management.',
        markets: ['R_100'],
        defaultStake: '2.00',
        martingale: '2.2',
        tradeType: 'DIGITOVER',
        risk: 'Medium',
        winRate: '~55%',
        icon: '⭐',
        badge: 'Classic',
    },
    {
        id: 'digit-over-split-martingale',
        name: '1-Tick Digit Over 2 (Split Martingale)',
        fileName: 'digit-over-split-martingale.xml',
        category: 'Volatility',
        description: 'Advanced split martingale strategy for 1-tick Digit Over 2 trades. Splits recovery across multiple trades to reduce drawdown risk.',
        markets: ['R_50', 'R_100'],
        defaultStake: '0.35',
        martingale: '2.5',
        tradeType: 'DIGITOVER',
        risk: 'High',
        winRate: '~58%',
        icon: '✂️',
        badge: 'Advanced',
    },
    {
        id: 'candle-mine-2025',
        name: 'Candle Mine 2025',
        fileName: 'candle-mine-2025.xml',
        category: 'Volatility',
        description: 'Updated 2025 version of Candle Mine for Volatility 100. Mines candle patterns to predict Even/Odd digit outcomes with precision.',
        markets: ['R_100'],
        defaultStake: '0.35',
        martingale: '2.2',
        tradeType: 'DIGITEVEN',
        risk: 'Medium',
        winRate: '~57%',
        icon: '⛏️',
        badge: 'Updated',
    },
    {
        id: 'binary-expert-pro',
        name: 'Binary Expert Pro 2025',
        fileName: 'binary-expert-pro.xml',
        category: 'Volatility 1s',
        description: 'Professional binary expert bot optimized for Volatility 1s indices. Uses advanced signal detection and high-stake recovery logic.',
        markets: ['1HZ10V', '1HZ25V', '1HZ50V'],
        defaultStake: '20.00',
        martingale: '2.2',
        tradeType: 'DIGITOVER',
        risk: 'High',
        winRate: '~60%',
        icon: '🏆',
        badge: 'Pro',
    },
    {
        id: 'alexspeedbot-expro2',
        name: 'AlexSpeedBot EXPRO2',
        fileName: 'alexspeedbot-expro2.xml',
        category: 'Volatility',
        description: 'High-speed expert trading bot by Alex. Rapid entry/exit logic with target profit and loss control. Designed for fast markets.',
        markets: ['R_100'],
        defaultStake: '2.00',
        martingale: '2.2',
        tradeType: 'DIGITOVER',
        risk: 'High',
        winRate: '~59%',
        icon: '⚡',
        badge: 'Hot',
    },
    {
        id: 'auto-c4-volt-ai',
        name: 'AUTO C4 VOLT AI Premium',
        fileName: 'auto-c4-volt-ai.xml',
        category: 'Volatility 1s',
        description: 'AI-powered C4 VOLT robot for Volatility 1s markets. Fully automated with intelligent market scanning and adaptive stake management.',
        markets: ['1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V'],
        defaultStake: '2.00',
        martingale: '2.2',
        tradeType: 'DIGITOVER',
        risk: 'Medium',
        winRate: '~61%',
        icon: '🤖',
        badge: 'AI Powered',
    },
    {
        id: 'vaio-pro-bot',
        name: 'VAIO Pro Bot',
        fileName: 'vaio-pro-bot.xml',
        category: 'Volatility 1s',
        description: 'VAIO prime trades bot for 1s indices. Focuses on high-probability setups with disciplined stake sizing and smart martingale.',
        markets: ['1HZ50V', '1HZ100V'],
        defaultStake: '1.00',
        martingale: '2.2',
        tradeType: 'DIGITOVER',
        risk: 'Low',
        winRate: '~57%',
        icon: '💎',
        badge: 'Stable',
    },
];

const RISK_COLOR: Record<string, string> = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' };

const PremiumBots = observer(({ handleTabChange }: { handleTabChange: (tab: number) => void }) => {
    const { dashboard } = useStore();
    const [loadingBot, setLoadingBot] = useState<string | null>(null);
    const [loadedBot, setLoadedBot] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [customStake, setCustomStake] = useState<Record<string, string>>({});
    const [customMartingale, setCustomMartingale] = useState<Record<string, string>>({});
    const [selectedCategory, setSelectedCategory] = useState<string>('All');

    const categories = ['All', ...Array.from(new Set(PREMIUM_BOTS.map(b => b.category)))];
    const filteredBots =
        selectedCategory === 'All' ? PREMIUM_BOTS : PREMIUM_BOTS.filter(b => b.category === selectedCategory);

    const handleLoadBot = async (bot: (typeof PREMIUM_BOTS)[0]) => {
        setLoadingBot(bot.id);
        setLoadError(null);
        try {
            const res = await fetch(`/bots/${bot.fileName}`);
            if (!res.ok) throw new Error(`Failed to fetch bot file (${res.status})`);
            const xmlText = await res.text();

            await load({
                block_string: xmlText,
                file_name: bot.name,
                workspace: window.Blockly?.derivWorkspace,
                from: 'local',
                drop_event: {},
                showIncompatibleStrategyDialog: false,
                show_snackbar: true,
            });

            setLoadedBot(bot.id);
            setTimeout(() => {
                dashboard.setActiveTab(DBOT_TABS.BOT_BUILDER);
                if (handleTabChange) handleTabChange(DBOT_TABS.BOT_BUILDER);
            }, 600);
        } catch (err: any) {
            setLoadError(`Could not load ${bot.name}: ${err.message}`);
        } finally {
            setLoadingBot(null);
        }
    };

    const getStake = (bot: (typeof PREMIUM_BOTS)[0]) => customStake[bot.id] ?? bot.defaultStake;
    const getMartingale = (bot: (typeof PREMIUM_BOTS)[0]) => customMartingale[bot.id] ?? bot.martingale;

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

            {loadError && (
                <div className='premium-bots__error'>
                    ⚠️ {loadError}
                    <button onClick={() => setLoadError(null)}>✕</button>
                </div>
            )}

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
                    const isLoading = loadingBot === bot.id;
                    return (
                        <div key={bot.id} className={`premium-bots__card ${isLoaded ? 'loaded' : ''}`}>
                            <div className='premium-bots__card-header'>
                                <div className='premium-bots__card-icon'>{bot.icon}</div>
                                <div className='premium-bots__card-meta'>
                                    <h3>{bot.name}</h3>
                                    <div className='premium-bots__badges'>
                                        <span className='premium-bots__badge premium-bots__badge--category'>
                                            {bot.category}
                                        </span>
                                        <span className='premium-bots__badge premium-bots__badge--type'>
                                            {bot.badge}
                                        </span>
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
                                        onChange={e =>
                                            setCustomStake(prev => ({ ...prev, [bot.id]: e.target.value }))
                                        }
                                        min='0.35'
                                        step='0.01'
                                    />
                                </div>
                                <div className='premium-bots__param'>
                                    <label>Martingale</label>
                                    <input
                                        type='number'
                                        value={getMartingale(bot)}
                                        onChange={e =>
                                            setCustomMartingale(prev => ({ ...prev, [bot.id]: e.target.value }))
                                        }
                                        min='1'
                                        step='0.1'
                                    />
                                </div>
                            </div>

                            <div className='premium-bots__markets'>
                                <span className='premium-bots__markets-label'>Markets:</span>
                                {bot.markets.slice(0, 3).map(m => (
                                    <span key={m} className='premium-bots__market-tag'>
                                        {m}
                                    </span>
                                ))}
                                {bot.markets.length > 3 && (
                                    <span className='premium-bots__market-tag'>+{bot.markets.length - 3}</span>
                                )}
                            </div>

                            <button
                                className={`premium-bots__load-btn ${isLoaded ? 'loaded' : ''} ${isLoading ? 'loading' : ''}`}
                                onClick={() => handleLoadBot(bot)}
                                disabled={isLoading || isLoaded}
                            >
                                {isLoading ? (
                                    <>
                                        <span className='premium-bots__spinner' /> Loading...
                                    </>
                                ) : isLoaded ? (
                                    '✅ Loaded in Bot Builder'
                                ) : (
                                    '🤖 Load Bot'
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

export default PremiumBots;
