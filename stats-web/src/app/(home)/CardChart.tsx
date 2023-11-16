import Box from "@mui/material/Box";
import { ReactNode } from "react";
import { ResponsiveLine, PointMouseHandler, Serie, Datum } from "@nivo/line";

type Props = {
  color: string;
  data: Datum[];
  onMouseEnter?: PointMouseHandler;
  onMouseLeave?: PointMouseHandler;
  onMouseMove?: PointMouseHandler;
  children?: ReactNode;
};

const CardChart: React.FunctionComponent<Props> = ({ children, color, data, onMouseEnter, onMouseLeave, onMouseMove }) => {
  return (
    <Box sx={{ position: "absolute", top: "60%", left: 0, width: "100%", height: "40%" }}>
      <ResponsiveLine
        data={[
          {
            id: "price data",
            data: data || []
          }
        ]}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
        xScale={{ type: "point" }}
        yScale={{
          type: "linear",
          min: "auto",
          max: "auto",
          stacked: true,
          reverse: false
        }}
        yFormat=" >-1d"
        curve="cardinal"
        axisTop={null}
        axisRight={null}
        axisBottom={null}
        axisLeft={null}
        enableGridX={false}
        enableGridY={false}
        colors={[color]}
        enablePoints={false}
        pointSize={1}
        pointColor={{ theme: "background" }}
        pointBorderWidth={2}
        pointBorderColor="black"
        pointLabelYOffset={-12}
        enableArea={true}
        areaOpacity={1}
        useMesh={true}
        enableCrosshair={true}
        crosshairType="x"
        tooltip={({ point }) => null}
      />
    </Box>
  );
};

export default CardChart;
