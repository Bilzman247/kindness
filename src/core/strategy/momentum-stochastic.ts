/**
 * Momentum Volatility Breakout Deviation Calculator with Stochastic Oscillator
 * Fixed internal mathematical model for auto trade decision making.
 * Computes price deviation, volatility envelope, and Stochastic %K / %D momentum.
 */

export interface PriceTick {
  price: number;
  time: number;
}

export class MomentumStochasticEngine {
  private ticks: number[] = [];
  private kHistory: number[] = [];
  private maxHistory = 30;

  public addTick(price: number): void {
    if (typeof price !== 'number' || isNaN(price)) return;
    this.ticks.push(price);
    if (this.ticks.length > this.maxHistory) {
      this.ticks.shift();
    }
  }

  public getSignal(): 'CALL' | 'PUT' {
    const n = this.ticks.length;
    if (n < 3) {
      // Not enough ticks yet: fallback to immediate direction if available
      return Math.random() > 0.5 ? 'CALL' : 'PUT';
    }

    const currentPrice = this.ticks[n - 1];

    // 1. Moving Average & Deviation Calculation
    const sum = this.ticks.reduce((a, b) => a + b, 0);
    const mean = sum / n;

    const variance = this.ticks.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance) || 0.0001;

    // Deviation Z-score
    const deviationZ = (currentPrice - mean) / stdDev;

    // 2. Stochastic Oscillator (%K & %D)
    const lookback = Math.min(n, 14);
    const recentWindow = this.ticks.slice(n - lookback);
    const high = Math.max(...recentWindow);
    const low = Math.min(...recentWindow);

    let kValue = 50;
    if (high !== low) {
      kValue = ((currentPrice - low) / (high - low)) * 100;
    }

    this.kHistory.push(kValue);
    if (this.kHistory.length > 5) this.kHistory.shift();

    const dValue = this.kHistory.reduce((a, b) => a + b, 0) / this.kHistory.length;

    // 3. Momentum & Volatility Breakout Decision
    // If stochastic is deeply oversold (< 25) with positive deviation bounce -> CALL
    if (kValue < 25 && currentPrice >= this.ticks[n - 2]) {
      return 'CALL';
    }

    // If stochastic is deeply overbought (> 75) with negative deviation turn -> PUT
    if (kValue > 75 && currentPrice <= this.ticks[n - 2]) {
      return 'PUT';
    }

    // Volatility breakout above upper deviation band (+0.75 sigma) with positive momentum
    if (deviationZ > 0.65 && kValue >= 50) {
      return 'CALL';
    }

    // Volatility breakout below lower deviation band (-0.65 sigma) with negative momentum
    if (deviationZ < -0.65 && kValue <= 50) {
      return 'PUT';
    }

    // Stochastic crossover confirmation
    if (kValue > dValue && currentPrice >= mean) {
      return 'CALL';
    } else if (kValue < dValue && currentPrice <= mean) {
      return 'PUT';
    }

    // Trend following continuation
    return currentPrice >= this.ticks[n - 2] ? 'CALL' : 'PUT';
  }
}
