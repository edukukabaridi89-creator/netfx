// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { api_base } from '@/external/bot-skeleton';
import './speed-lab.scss';

const SYMBOLS = [
    { value: 'R_10',    label: 'Volatility 10  (V10)' },
    { value: 'R_25',    label: 'Volatility 25  (V25)' },
    { value: 'R_50',    label: 'Volatility 50  (V50)' },
    { value: 'R_75',    label: 'Volatility 75  (V75)' },
    { value: 'R_100',   label: 'Volatility 100 (V100)' },
    { value: '1HZ10V',  label: 'Volatility 10  (1s)' },
    { value: '1HZ25V',  label: 'Volatility 25  (1s)' },
    { value: '1HZ50V',  label: 'Volatility 50  (1s)' },
    { value: '1HZ75V',  label: 'Volatility 75  (1s)' },
    { value: '1HZ100V', label: 'Volatility 100 (1s)' },
];

const TRADE_TYPES = [
    { key: 'DIGITOVER',  label: 'Over',    needsBarrier: true  },
    { key: 'DIGITUNDER', label: 'Under',   needsBarrier: true  },
    { key: 'DIGITEVEN',  label: 'Even',    needsBarrier: false },
    { key: 'DIGITODD',   label: 'Odd',     needsBarrier: false },
    { key: 'CALL',       label: 'Rise',    needsBarrier: false },
    { key: 'PUT',        label: 'Fall',    needsBarrier: false },
    { key: 'DIGITMATCH', label: 'Matches', needsBarrier: true  },
    { key: 'DIGITDIFF',  label: 'Differs', needsBarrier: true  },
];

type TradeStatus = 'buying' | 'open' | 'won' | 'lost' | 'error';

interface TradeEntry {
    id: number;
    status: TradeStatus;
    contractId?: number;
    profit?: number;
    buyPrice?: number;
    tick?: number;          // which tick triggered this trade
    errorMsg?: string;
}

let _reqId = 30000;
const nextReqId = () => ++_reqId;

function sendRequest(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        if (!api_base.api) { reject(new Error('Not connected')); return; }
        const req_id = nextReqId();
        const sub = api_base.api.onMessage().subscribe((msg: any) => {
            if (msg.req_id === req_id) {
                sub.unsubscribe();
                if (msg.error) reject(new Error(msg.error.message || 'API error'));
                else resolve(msg);
            }
        });
        api_base.api.send({ ...data, req_id });
    });
}

const MAX_DISPLAY = 100; // keep only last N trades in view

const SpeedLab: React.FC = () => {
    const [symbol,    setSymbol]    = useState('R_100');
    const [tradeType, setTradeType] = useState('DIGITEVEN');
    const [barrier,   setBarrier]   = useState('5');
    const [stake,     setStake]     = useState('1');
    const [maxRuns,   setMaxRuns]   = useState(10);
    const [unlimited, setUnlimited] = useState(false);

    const [isRunning, setIsRunning] = useState(false);
    const [trades,    setTrades]    = useState<TradeEntry[]>([]);
    const [error,     setError]     = useState('');

    // Live counters (refs avoid re-renders on every trade)
    const countRef   = useRef(0);
    const wonRef     = useRef(0);
    const lostRef    = useRef(0);
    const profitRef  = useRef(0);
    const tradeIdRef = useRef(0);
    const [displayStats, setDisplayStats] = useState({ count: 0, won: 0, lost: 0, profit: 0 });

    const stopRef       = useRef(false);
    const tickSubRef    = useRef<(() => void) | null>(null);
    const inFlightRef   = useRef(new Set<number>());    // contract IDs being tracked

    const currency   = (api_base as any).account_info?.currency || 'USD';
    const selectedType = TRADE_TYPES.find(t => t.key === tradeType)!;

    // Update display stats (throttled via RAF)
    const rafRef = useRef<number | null>(null);
    const flushStats = useCallback(() => {
        setDisplayStats({
            count:  countRef.current,
            won:    wonRef.current,
            lost:   lostRef.current,
            profit: profitRef.current,
        });
    }, []);

    const scheduleStatFlush = useCallback(() => {
        if (rafRef.current) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            flushStats();
        });
    }, [flushStats]);

    const addTrade = useCallback((entry: TradeEntry) => {
        setTrades(prev => [entry, ...prev].slice(0, MAX_DISPLAY));
    }, []);

    const updateTrade = useCallback((id: number, patch: Partial<TradeEntry>) => {
        setTrades(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    }, []);

    // Place a single trade immediately (no proposal round-trip — direct buy)
    const placeTrade = useCallback(async (tickNum: number) => {
        if (!api_base.api) return;

        const tradeId = ++tradeIdRef.current;
        const stakeVal = parseFloat(stake) || 1;

        const entry: TradeEntry = { id: tradeId, status: 'buying', tick: tickNum };
        addTrade(entry);
        countRef.current += 1;
        scheduleStatFlush();

        try {
            // Direct buy (no separate proposal step — fastest path)
            const buyReq: Record<string, unknown> = {
                buy: '1',
                price: stakeVal,
                parameters: {
                    amount: stakeVal,
                    basis: 'stake',
                    contract_type: tradeType,
                    currency,
                    duration: 1,
                    duration_unit: 't',
                    symbol,
                    ...(selectedType.needsBarrier ? { barrier } : {}),
                },
            };

            const buyResp = await sendRequest(buyReq);
            const bought  = (buyResp as any).buy;

            if (!bought) {
                // Fallback: proposal then buy
                const propReq: Record<string, unknown> = {
                    proposal: 1,
                    amount: stakeVal,
                    basis: 'stake',
                    contract_type: tradeType,
                    currency,
                    duration: 1,
                    duration_unit: 't',
                    symbol,
                    ...(selectedType.needsBarrier ? { barrier } : {}),
                };
                const propResp = await sendRequest(propReq);
                const proposal = (propResp as any).proposal;
                if (!proposal) throw new Error('No proposal');
                const buyResp2  = await sendRequest({ buy: proposal.id, price: proposal.ask_price });
                const bought2   = (buyResp2 as any).buy;
                if (!bought2) throw new Error('Buy failed');
                return continueTracking(tradeId, bought2.contract_id, bought2.buy_price);
            }

            continueTracking(tradeId, bought.contract_id, bought.buy_price);

        } catch (err: any) {
            updateTrade(tradeId, { status: 'error', errorMsg: err.message });
            scheduleStatFlush();
        }
    }, [symbol, tradeType, barrier, stake, currency, selectedType, addTrade, updateTrade, scheduleStatFlush]);

    function continueTracking(tradeId: number, contractId: number, buyPrice: number) {
        updateTrade(tradeId, { status: 'open', contractId, buyPrice });
        inFlightRef.current.add(contractId);

        if (!api_base.api) return;
        const sub = api_base.api.onMessage().subscribe((msg: any) => {
            const poc = msg?.proposal_open_contract;
            if (!poc || poc.contract_id !== contractId) return;
            if (poc.status === 'sold' || poc.is_sold) {
                sub.unsubscribe();
                inFlightRef.current.delete(contractId);
                const profit = typeof poc.profit === 'number'
                    ? poc.profit
                    : (poc.sell_price - poc.buy_price);
                updateTrade(tradeId, {
                    status: profit >= 0 ? 'won' : 'lost',
                    profit,
                });
                if (profit >= 0) wonRef.current += 1;
                else             lostRef.current += 1;
                profitRef.current += profit;
                scheduleStatFlush();
            }
        });
        api_base.api.send({
            proposal_open_contract: 1,
            contract_id: contractId,
            subscribe: 1,
            req_id: nextReqId(),
        });
    }

    const startSpeedLab = useCallback(() => {
        if (!api_base.api) { setError('Please log in first.'); return; }
        setError('');

        // Reset counters
        countRef.current  = 0;
        wonRef.current    = 0;
        lostRef.current   = 0;
        profitRef.current = 0;
        tradeIdRef.current = 0;
        setTrades([]);
        setDisplayStats({ count: 0, won: 0, lost: 0, profit: 0 });
        stopRef.current = false;
        setIsRunning(true);

        let tickNum = 0;

        // Subscribe to live ticks — fire a trade on EVERY tick
        const sub = api_base.api.onMessage().subscribe((msg: any) => {
            if (msg.msg_type !== 'tick' || !msg.tick) return;
            if (stopRef.current) return;

            tickNum += 1;
            if (!unlimited && tickNum > maxRuns) {
                stopSpeedLab();
                return;
            }

            placeTrade(tickNum);
        });

        tickSubRef.current = () => sub.unsubscribe();

        // Subscribe to ticks
        api_base.api.send({
            ticks: symbol,
            subscribe: 1,
            req_id: nextReqId(),
        });
    }, [symbol, unlimited, maxRuns, placeTrade]);

    const stopSpeedLab = useCallback(() => {
        stopRef.current = true;
        tickSubRef.current?.();
        tickSubRef.current = null;
        setIsRunning(false);
        flushStats();
    }, [flushStats]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopRef.current = true;
            tickSubRef.current?.();
        };
    }, []);

    // Auto-stop when maxRuns reached (for limited mode)
    useEffect(() => {
        if (!unlimited && isRunning && displayStats.count >= maxRuns) {
            stopSpeedLab();
        }
    }, [displayStats.count, maxRuns, unlimited, isRunning, stopSpeedLab]);

    const winPct = displayStats.count > 0
        ? ((displayStats.won / displayStats.count) * 100).toFixed(1)
        : '0.0';

    return (
        <div className='speed-lab'>
            <div className='speed-lab__header'>
                <div className='speed-lab__header-icon'>
                    <svg width='36' height='36' viewBox='0 0 40 40' fill='none'>
                        <path d='M20 4 L13 24 L20 20 L20 36 L27 16 L20 20 Z' fill='currentColor' />
                    </svg>
                </div>
                <div>
                    <h1 className='speed-lab__title'>Speed Lab</h1>
                    <p className='speed-lab__subtitle'>One trade per tick — continuous, uninterrupted execution</p>
                </div>
            </div>

            <div className='speed-lab__form'>
                {/* Volatility */}
                <div className='speed-lab__field'>
                    <label className='speed-lab__label'>Volatility Index</label>
                    <select
                        className='speed-lab__select'
                        value={symbol}
                        onChange={e => setSymbol(e.target.value)}
                        disabled={isRunning}
                    >
                        {SYMBOLS.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>

                {/* Trade Type */}
                <div className='speed-lab__field'>
                    <label className='speed-lab__label'>Trade Type</label>
                    <div className='speed-lab__type-grid'>
                        {TRADE_TYPES.map(t => (
                            <button
                                key={t.key}
                                className={`speed-lab__type-btn${tradeType === t.key ? ' active' : ''}`}
                                onClick={() => setTradeType(t.key)}
                                disabled={isRunning}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Digit Barrier */}
                {selectedType.needsBarrier && (
                    <div className='speed-lab__field'>
                        <label className='speed-lab__label'>
                            Digit Barrier &nbsp;
                            <span className='speed-lab__label-hint'>
                                ({tradeType === 'DIGITOVER'  ? '>' :
                                  tradeType === 'DIGITUNDER' ? '<' :
                                  tradeType === 'DIGITMATCH' ? '='  : '≠'} {barrier})
                            </span>
                        </label>
                        <div className='speed-lab__barrier-grid'>
                            {Array.from({ length: 10 }, (_, i) => (
                                <button
                                    key={i}
                                    className={`speed-lab__barrier-btn${barrier === String(i) ? ' active' : ''}`}
                                    onClick={() => setBarrier(String(i))}
                                    disabled={isRunning}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className='speed-lab__row'>
                    <div className='speed-lab__field'>
                        <label className='speed-lab__label'>Stake ({currency})</label>
                        <input
                            className='speed-lab__input'
                            type='number'
                            min='0.35'
                            step='0.01'
                            value={stake}
                            onChange={e => setStake(e.target.value)}
                            disabled={isRunning}
                        />
                    </div>

                    <div className='speed-lab__field'>
                        <label className='speed-lab__label'>
                            Runs
                            <label className='speed-lab__unlimited-toggle'>
                                <input
                                    type='checkbox'
                                    checked={unlimited}
                                    onChange={e => setUnlimited(e.target.checked)}
                                    disabled={isRunning}
                                />
                                <span>Unlimited</span>
                            </label>
                        </label>
                        {!unlimited && (
                            <input
                                className='speed-lab__input'
                                type='number'
                                min='1'
                                max='1000'
                                value={maxRuns}
                                onChange={e => setMaxRuns(Math.max(1, parseInt(e.target.value) || 1))}
                                disabled={isRunning}
                            />
                        )}
                        {unlimited && (
                            <div className='speed-lab__unlimited-badge'>∞ until stopped</div>
                        )}
                    </div>
                </div>

                {error && <div className='speed-lab__error'>⚠️ {error}</div>}

                {!isRunning ? (
                    <button className='speed-lab__start-btn' onClick={startSpeedLab}>
                        🚀 Start Speed Lab
                    </button>
                ) : (
                    <button className='speed-lab__stop-btn' onClick={stopSpeedLab}>
                        ⏹ Stop
                    </button>
                )}
            </div>

            {/* Live stats */}
            <div className='speed-lab__stats'>
                <div className='speed-lab__stat'>
                    <span className='speed-lab__stat-val'>{displayStats.count}</span>
                    <span className='speed-lab__stat-lbl'>Trades</span>
                    {!unlimited && isRunning && (
                        <span className='speed-lab__stat-sub'>/ {maxRuns}</span>
                    )}
                </div>
                <div className='speed-lab__stat speed-lab__stat--won'>
                    <span className='speed-lab__stat-val'>{displayStats.won}</span>
                    <span className='speed-lab__stat-lbl'>Won</span>
                </div>
                <div className='speed-lab__stat speed-lab__stat--lost'>
                    <span className='speed-lab__stat-val'>{displayStats.lost}</span>
                    <span className='speed-lab__stat-lbl'>Lost</span>
                </div>
                <div className='speed-lab__stat'>
                    <span className='speed-lab__stat-val'>{winPct}%</span>
                    <span className='speed-lab__stat-lbl'>Win Rate</span>
                </div>
                <div className={`speed-lab__stat ${displayStats.profit >= 0 ? 'speed-lab__stat--profit' : 'speed-lab__stat--loss'}`}>
                    <span className='speed-lab__stat-val'>
                        {displayStats.profit >= 0 ? '+' : ''}{displayStats.profit.toFixed(2)}
                    </span>
                    <span className='speed-lab__stat-lbl'>Net P/L</span>
                </div>
            </div>

            {/* Trade feed */}
            {trades.length > 0 && (
                <div className='speed-lab__feed'>
                    <div className='speed-lab__feed-header'>
                        Live Trade Feed
                        <span className='speed-lab__feed-hint'>(latest {Math.min(trades.length, MAX_DISPLAY)})</span>
                    </div>
                    <div className='speed-lab__feed-list'>
                        {trades.map(t => (
                            <div key={t.id} className={`speed-lab__trade speed-lab__trade--${t.status}`}>
                                <span className='speed-lab__trade-tick'>T{t.tick}</span>
                                <span className='speed-lab__trade-type'>{selectedType.label}</span>
                                <span className='speed-lab__trade-status'>
                                    {t.status === 'buying' && '📤'}
                                    {t.status === 'open'   && '🔄'}
                                    {t.status === 'won'    && `✅ +${(t.profit ?? 0).toFixed(2)}`}
                                    {t.status === 'lost'   && `❌ ${(t.profit ?? 0).toFixed(2)}`}
                                    {t.status === 'error'  && `⚠️ ${t.errorMsg}`}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpeedLab;
