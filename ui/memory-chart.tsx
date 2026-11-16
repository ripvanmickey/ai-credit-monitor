import {createRoot} from 'react-dom/client';
import {CartesianGrid, Line, LineChart, XAxis, YAxis} from 'recharts';
import {ChartContainer, ChartTooltip, ChartTooltipContent} from './components/chart';

type MemoryHistory = {
  spec: string;
  unit: string;
  points: {date: string; value: number}[];
};

function MemoryHistoryChart({spec, unit, points}: MemoryHistory) {
  const data = points.map(point => ({...point, time: Date.parse(point.date)}));
  const dates = data.map(point => point.time);
  const ticks = dates.length <= 5 ? dates : undefined;
  const dateLabel = (value: number) => new Date(value).toISOString().slice(0, 10);
  const amounts = data.map(point => point.value);
  const low = Math.min(...amounts);
  const high = Math.max(...amounts);
  const padding = Math.max((high - low) * 0.2, high * 0.005);
  const amount = (value: number) => value.toLocaleString('en-US', {maximumFractionDigits: 3});

  return <div data-no-i18n>
    <p className="memory-chart-spec">{spec}</p>
    <small className="memory-chart-unit">{unit}</small>
    <ChartContainer config={{value: {label: spec, color: '#b32323'}}} style={{width: '100%', height: 248}}>
      <LineChart data={data} accessibilityLayer margin={{top: 8, right: 55, bottom: 6, left: 4}}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']}
          ticks={ticks} tickFormatter={dateLabel} tickLine={false} axisLine={false} minTickGap={12} />
        <YAxis domain={[Math.max(0, low - padding), high + padding]} tickFormatter={amount}
          width={55} tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={value => dateLabel(Number(value))}
          formatter={value => <span>{amount(Number(value))} {unit}</span>} />} />
        <Line dataKey="value" type="linear" stroke="var(--color-value)" strokeWidth={2}
          dot={{r: 4, fill: 'var(--color-value)'}} activeDot={{r: 6}} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  </div>;
}

export function mountMemoryChart(host: HTMLElement) {
  const chartHost = host as HTMLElement & {memoryHistory?: MemoryHistory | null};
  const root = createRoot(chartHost);
  const render = () => {
    const history = chartHost.memoryHistory;
    root.render(history ? <MemoryHistoryChart {...history} /> : null);
  };
  chartHost.addEventListener('memory-history-change', render);
  render();
}
