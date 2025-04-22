import * as React from 'react';
import { BarChart, LineChart, PieChart, ScatterChart } from '@mui/x-charts';
import { Typography, Box } from '@mui/material';

// Sample data for the Bar Chart
const barData = [
  { category: 'A', value: 10 },
  { category: 'B', value: 20 },
  { category: 'C', value: 15 },
];

// Sample data for the Line Chart
const lineData = [
  { x: 0, y: 0 },
  { x: 1, y: 2 },
  { x: 2, y: 4 },
  { x: 3, y: 6 },
];

// Sample data for the Pie Chart
const pieData = [
  { label: 'Group A', value: 400 },
  { label: 'Group B', value: 300 },
  { label: 'Group C', value: 300 },
];

// Sample data for the Area Chart
const areaData = [
  { x: 0, y: 0 },
  { x: 1, y: 2 },
  { x: 2, y: 5 },
  { x: 3, y: 3 },
];

// Sample data for the Scatter Chart
const scatterData = [
  { x: 1, y: 2 },
  { x: 2, y: 4 },
  { x: 3, y: 1 },
  { x: 4, y: 5 },
];

export default function MultiChartComponent() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Bar Chart Section */}
      <Typography variant="h6">Bar Chart</Typography>
      <BarChart
        series={[{ data: barData.map(item => item.value) }]}
        xAxis={[{ data: barData.map(item => item.category), scaleType: 'band' }]}
        height={300}
      />

      {/* Line Chart Section */}
      <Typography variant="h6">Line Chart</Typography>
      <LineChart
        series={[{ data: lineData.map(item => item.y) }]}
        xAxis={[{ data: lineData.map(item => item.x) }]}
        height={300}
      />

      {/* Pie Chart Section */}
      <Typography variant="h6">Pie Chart</Typography>
      <PieChart
        series={[{ data: pieData }]}
        height={300}
      />

      {/* Area Chart Section */}
      <Typography variant="h6">Area Chart</Typography>
      <LineChart
        series={[{ data: areaData.map(item => item.y), area: true }]}
        xAxis={[{ data: areaData.map(item => item.x) }]}
        height={300}
      />

      {/* Scatter Chart Section */}
      <Typography variant="h6">Scatter Chart</Typography>
      <ScatterChart
        series={[{ data: scatterData.map(item => ({ x: item.x, y: item.y })) }]}
        height={300}
      />
    </Box>
  );
}