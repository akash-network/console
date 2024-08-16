"use client";
import { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import React from "react";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

export const DashboardCharts: React.FunctionComponent = () => {
  const chartOptions: ApexOptions = {
    chart: {
      height: 125,
      type: "line",
      zoom: {
        enabled: false
      },
      toolbar: {
        show: false
      }
    },
    stroke: {
      curve: "smooth"
    },
    dataLabels: {
      enabled: true, // Enable data labels
      formatter: function (val) {
        return val.toString(); // Show the value as a label
      },
      style: {
        fontSize: "8px",
        colors: ["#515151"] // Color of the labels
      },
      offsetY: -5 // Adjust the position of the labels above the points
    },
    xaxis: {
      labels: {
        show: false
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      show: false
    },
    grid: {
      show: false
    }
  };
  const chartvariable = {
    series: [
      {
        name: "Desktops",
        data: [15, 0, 25, 0, 45, 70]
      }
    ],
    options: {
      chart: {
        height: 150,
        type: "line",
        zoom: {
          enabled: false
        }
      },
      dataLabels: {
        enabled: false
      },
      stroke: {
        curve: "smooth"
      }
    }
  };

  return (
    <div>
      <div id="chart">
        {typeof window !== "undefined" && <Chart options={chartOptions} series={chartvariable.series} type="line" height={125} width={150} />}
      </div>
      <div id="html-dist"></div>
    </div>
  );
};
