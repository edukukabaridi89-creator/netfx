// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { load } from '@/external/bot-skeleton';
import { api_base } from '@/external/bot-skeleton';
import './ai-floating-btn.scss';

const APP_ID = '61453';
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;

const SCAN_MARKETS = [
    { symbol: 'R_10',    label: 'V10' },
    { symbol: 'R_25',    label: 'V25' },
    { symbol: 'R_50',    label: 'V50' },
    { symbol: 'R_75',    label: 'V75' },
    { symbol: 'R_100',   label: 'V100' },
    { symbol: '1HZ10V',  label: 'V10(1s)' },
    { symbol: '1HZ25V',  label: 'V25(1s)' },
    { symbol: '1HZ50V',  label: 'V50(1s)' },
    { symbol: '1HZ75V',  label: 'V75(1s)' },
    { symbol: '1HZ100V', label: 'V100(1s)' },
];

const TRADE_TYPES = [
    { key: 'even_odd',        label: 'Even / Odd',        icon: '⚖️' },
    { key: 'over_under',      label: 'Over / Under',      icon: '📈' },
    { key: 'matches_differs', label: 'Matches / Differs', icon: '🎯' },
];

const BOT_FOR_TYPE: Record<string, string> = {
    even_odd:        'auto-c4-volt-ai.xml',
    over_under:      'dollar-hunter-bot.xml',
    matches_differs: 'vaio-pro-bot.xml',
};

const CONTRACT_FOR_SIGNAL = (tradeType: string, signal: any) => {
    if (tradeType === 'even_odd') return signal.evenPct > 55 ? 'DIGITEVEN' : 'DIGITODD';
    if (tradeType === 'over_under') return signal.over4Pct > 55 ? 'DIGITOVER' : 'DIGITUNDER';
    if (tradeType === 'matches_differs') return 'DIGITDIFF';
    return 'DIGITEVEN';
};

type ScanResult = {
    symbol: string;
    label: string;
    evenPct: number;
    oddPct: number;
    over4Pct: number;
    under5Pct: number;
    mostFreqDigit: number;
    leastFreqDigit: number;
    score: number;
    digits: number[];
};

function collectTicks(symbol: string, count = 20): Promise<number[]> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(WS_URL);
        const ticks: number[] = [];
        const timeout = setTimeout(() => { ws.close(); resolve(ticks); }, 8000);

        ws.onopen = () => ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.msg_type === 'tick' && data.tick) {
                const q = data.tick.quote.toString();
                ticks.push(parseInt(q[q.length - 1], 10));
                if (ticks.length >= count) {
                    clearTimeout(timeout);
                    ws.close();
                    resolve(ticks);
                }
            }
        };
        ws.onerror = () => { clearTimeout(timeout); ws.close(); resolve(ticks); };
    });
}

function analyzeDigits(symbol: string, label: string, digits: number[]): ScanResult {
    const n = digits.length || 1;
    const counts = Array.from({ length: 10 }, (_, d) => digits.filter(x => x === d).length);
    const evenPct  = Math.round((digits.filter(d => d % 2 === 0).length / n) * 100);
    const over4Pct = Math.round((digits.filter(d => d > 4).length / n) * 100);
    const mostFreqDigit  = counts.indexOf(Math.max(...counts));
    const leastFreqDigit = counts.indexOf(Math.min(...counts));

    // Score = how extreme the distribution is (higher = stronger signal)
    const score = Math.max(Math.abs(evenPct - 50), Math.abs(over4Pct - 50));

    return {
        symbol, label,
        evenPct, oddPct: 100 - evenPct,
        over4Pct, under5Pct: 100 - over4Pct,
        mostFreqDigit, leastFreqDigit,
        score, digits,
    };
}

type Phase = 'closed' | 'open' | 'scanning' | 'result' | 'running';

const AiFloatingBtn: React.FC<{ handleTabChange?: (tab: number) => void }> = ({ handleTabChange }) => {
    const [phase, setPhase]           = useState<Phase>('closed');
    const [tradeType, setTradeType]   = useState('even_odd');
    const [scanProgress, setScanProgress] = useState<Record<string, 'pending' | 'scanning' | 'done'>>({});
    const [results, setResults]       = useState<ScanResult[]>([]);
    const [best, setBest]             = useState<ScanResult | null>(null);
    const [runStatus, setRunStatus]   = useState<'idle' | 'loading' | 'running' | 'error'>('idle');
    const [runMsg, setRunMsg]         = useState('');
    const abortRef = useRef(false);

    const openModal  = () => { abortRef.current = false; setPhase('open'); };
    const closeModal = () => {
        abortRef.current = true;
        setPhase('closed');
        setResults([]);
        setBest(null);
        setRunStatus('idle');
        setRunMsg('');
        setScanProgress({});
    };

    const startScan = useCallback(async () => {
        abortRef.current = false;
        setPhase('scanning');
        setResults([]);
        setBest(null);
        setRunStatus('idle');

        const progress: Record<string, 'pending' | 'scanning' | 'done'> = {};
        SCAN_MARKETS.forEach(m => { progress[m.symbol] = 'pending'; });
        setScanProgress({ ...progress });

        const allResults: ScanResult[] = [];

        for (const market of SCAN_MARKETS) {
            if (abortRef.current) break;
            setScanProgress(prev => ({ ...prev, [market.symbol]: 'scanning' }));
            const ticks = await collectTicks(market.symbol, 20);
            const result = analyzeDigits(market.symbol, market.label, ticks);
            allResults.push(result);
            setResults([...allResults]);
            setScanProgress(prev => ({ ...prev, [market.symbol]: 'done' }));
        }

        if (!abortRef.current && allResults.length > 0) {
            const bestResult = allResults.reduce((a, b) => b.score > a.score ? b : a);
            setBest(bestResult);
            setPhase('result');
        }
    }, []);

    const handleAutoRun = useCallback(async () => {
        if (!best) return;
        setRunStatus('loading');
        setRunMsg('Loading bot XML...');

        try {
            const botFile = BOT_FOR_TYPE[tradeType];
            const res = await fetch(`/bots/${botFile}`);
            if (!res.ok) throw new Error(`Could not load bot file (${res.status})`);
            const xmlText = await res.text();

            setRunMsg('Loading into Bot Builder...');
            await load({
                block_string: xmlText,
                file_name: `AI-${best.label}-${tradeType}`,
                workspace: window.Blockly?.derivWorkspace,
                from: 'local',
                drop_event: {},
                showIncompatibleStrategyDialog: false,
                show_snackbar: false,
            });

            // Switch to Bot Builder tab
            if (handleTabChange) handleTabChange(1);

            setRunMsg('Starting bot...');
            // Give workspace time to render, then click run
            setTimeout(() => {
                const runBtn = document.getElementById('db-animation__run-button') ||
                               document.querySelector('[data-testid="dt_bot_run_button"]') ||
                               document.querySelector('.run-panel__run-button') ||
                               document.querySelector('button[class*="run"]');
                if (runBtn) {
                    (runBtn as HTMLButtonElement).click();
                    setRunStatus('running');
                    setRunMsg(`✅ Bot running on ${best.label}! Check Summary, Transactions & Journal tabs.`);
                    setPhase('running');
                } else {
                    setRunStatus('running');
                    setRunMsg(`✅ Bot loaded on ${best.label}. Click the Run button in Bot Builder to start.`);
                    setPhase('running');
                }
            }, 1200);
        } catch (err: any) {
            setRunStatus('error');
            setRunMsg(`Error: ${err.message}`);
        }
    }, [best, tradeType, handleTabChange]);

    const getSignalLabel = (result: ScanResult) => {
        if (tradeType === 'even_odd')
            return result.evenPct > 55 ? `🔴 Even bias (${result.evenPct}%)` :
                   result.oddPct > 55  ? `🟣 Odd bias (${result.oddPct}%)`   : '⚪ Balanced';
        if (tradeType === 'over_under')
            return result.over4Pct > 55 ? `📈 Over bias (${result.over4Pct}%)` :
                   result.under5Pct > 55 ? `📉 Under bias (${result.under5Pct}%)` : '⚪ Balanced';
        return `🎯 Differs (least: ${result.leastFreqDigit})`;
    };

    return (
        <>
            {/* Floating button */}
            <button
                className={`ai-fab ${phase !== 'closed' ? 'ai-fab--open' : ''}`}
                onClick={phase === 'closed' ? openModal : closeModal}
                title='AI Auto-Trader'
            >
                <span className='ai-fab__ring' />
                <span className='ai-fab__ring ai-fab__ring--2' />
                <span className='ai-fab__icon'>🤖</span>
                <span className='ai-fab__label'>AI</span>
            </button>

            {/* Modal */}
            {phase !== 'closed' && (
                <div className='ai-fab-modal'>
                    <div className='ai-fab-modal__overlay' onClick={closeModal} />
                    <div className='ai-fab-modal__panel'>
                        <div className='ai-fab-modal__header'>
                            <div className='ai-fab-modal__title'>
                                <span>🤖</span>
                                <div>
                                    <h2>AI Market Scanner</h2>
                                    <p>Analyzes all volatility markets and auto-runs the best bot</p>
                                </div>
                            </div>
                            <button className='ai-fab-modal__close' onClick={closeModal}>✕</button>
                        </div>

                        {/* Trade type selector */}
                        {(phase === 'open' || phase === 'scanning') && (
                            <>
                                <div className='ai-fab-modal__section'>
                                    <label className='ai-fab-modal__label'>Trade Type</label>
                                    <div className='ai-fab-modal__trade-types'>
                                        {TRADE_TYPES.map(t => (
                                            <button
                                                key={t.key}
                                                className={`ai-fab-modal__tt-btn ${tradeType === t.key ? 'active' : ''}`}
                                                onClick={() => setTradeType(t.key)}
                                                disabled={phase === 'scanning'}
                                            >
                                                <span>{t.icon}</span>
                                                <span>{t.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className='ai-fab-modal__section'>
                                    <label className='ai-fab-modal__label'>Market Scan Progress</label>
                                    <div className='ai-fab-modal__scan-grid'>
                                        {SCAN_MARKETS.map(m => {
                                            const st = scanProgress[m.symbol] || 'pending';
                                            const done = results.find(r => r.symbol === m.symbol);
                                            return (
                                                <div key={m.symbol} className={`ai-fab-modal__scan-item ai-fab-modal__scan-item--${st}`}>
                                                    <span className='ai-fab-modal__scan-label'>{m.label}</span>
                                                    {st === 'pending' && <span className='ai-fab-modal__scan-dot'>○</span>}
                                                    {st === 'scanning' && <span className='ai-fab-modal__scan-spin'>⟳</span>}
                                                    {st === 'done' && done && (
                                                        <span className='ai-fab-modal__scan-score'>
                                                            {done.score.toFixed(0)}%
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {phase === 'open' && (
                                    <button className='ai-fab-modal__scan-btn' onClick={startScan}>
                                        🔍 Scan All Markets
                                    </button>
                                )}

                                {phase === 'scanning' && (
                                    <div className='ai-fab-modal__scanning-msg'>
                                        <span className='ai-fab-modal__scan-spinner' />
                                        Scanning {SCAN_MARKETS.length} markets in real-time...
                                    </div>
                                )}
                            </>
                        )}

                        {/* Result phase */}
                        {phase === 'result' && best && (
                            <div className='ai-fab-modal__result'>
                                <div className='ai-fab-modal__best-header'>
                                    <span className='ai-fab-modal__best-trophy'>🏆</span>
                                    <div>
                                        <div className='ai-fab-modal__best-market'>{best.label}</div>
                                        <div className='ai-fab-modal__best-signal'>{getSignalLabel(best)}</div>
                                    </div>
                                    <div className='ai-fab-modal__best-score'>{best.score.toFixed(0)}%</div>
                                </div>

                                <div className='ai-fab-modal__all-results'>
                                    {results
                                        .sort((a, b) => b.score - a.score)
                                        .map(r => (
                                            <div key={r.symbol} className={`ai-fab-modal__result-row ${r.symbol === best.symbol ? 'best' : ''}`}>
                                                <span className='ai-fab-modal__result-label'>{r.label}</span>
                                                <div className='ai-fab-modal__result-bar-wrap'>
                                                    <div
                                                        className='ai-fab-modal__result-bar'
                                                        style={{ width: `${Math.min(r.score * 2, 100)}%` }}
                                                    />
                                                </div>
                                                <span className='ai-fab-modal__result-pct'>{r.score.toFixed(0)}%</span>
                                            </div>
                                        ))}
                                </div>

                                <div className='ai-fab-modal__action-row'>
                                    <button className='ai-fab-modal__rescan-btn' onClick={startScan}>
                                        🔄 Re-scan
                                    </button>
                                    <button className='ai-fab-modal__run-btn' onClick={handleAutoRun}>
                                        🚀 Auto-Run Bot on {best.label}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Running phase */}
                        {phase === 'running' && (
                            <div className='ai-fab-modal__running'>
                                {runStatus === 'loading' && (
                                    <div className='ai-fab-modal__run-progress'>
                                        <span className='ai-fab-modal__scan-spinner' />
                                        <span>{runMsg}</span>
                                    </div>
                                )}
                                {runStatus === 'running' && (
                                    <div className='ai-fab-modal__run-success'>
                                        <div className='ai-fab-modal__run-success-icon'>✅</div>
                                        <div>{runMsg}</div>
                                        <div className='ai-fab-modal__run-tabs-hint'>
                                            Check: <strong>Summary</strong> · <strong>Transactions</strong> · <strong>Journal</strong>
                                        </div>
                                        <button className='ai-fab-modal__scan-btn' onClick={() => { setPhase('open'); setResults([]); setBest(null); setScanProgress({}); }}>
                                            🔍 Scan Again
                                        </button>
                                    </div>
                                )}
                                {runStatus === 'error' && (
                                    <div className='ai-fab-modal__run-error'>
                                        ⚠️ {runMsg}
                                        <button onClick={() => setRunStatus('idle')}>Retry</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default AiFloatingBtn;
