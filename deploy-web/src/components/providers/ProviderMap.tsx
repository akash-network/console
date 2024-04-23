import { makeStyles } from "tss-react/mui";
import { ApiProviderList } from "@src/types/provider";
import { ComposableMap, Geographies, Geography, Marker, Point, ZoomableGroup } from "react-simple-maps";
import { useState } from "react";
import { Box, IconButton, useTheme } from "@mui/material";
import { CustomTooltip } from "../shared/CustomTooltip";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

const useStyles = makeStyles()(theme => ({
  circle: {
    cursor: "pointer"
  }
}));

type Props = {
  initialZoom?: number;
  initialCoordinates?: Point;
  providers: ApiProviderList[];
};

const minZoom = 1;
const maxZoom = 8;

export const ProviderMap: React.FunctionComponent<Props> = ({ providers, initialZoom = minZoom, initialCoordinates = [0, 0] }) => {
  const { classes } = useStyles();
  const [dotSize, setDotSize] = useState({ r: 5, w: 1 });
  const theme = useTheme();
  const activeProviders = providers.filter(x => x.isOnline);
  const bgColor = theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[400];
  const [position, setPosition] = useState({ coordinates: initialCoordinates, zoom: initialZoom });
  const isInitialPosition =
    position.coordinates[0] === initialCoordinates[0] && position.coordinates[1] === initialCoordinates[1] && position.zoom === initialZoom;

  function resetZoom() {
    setPosition({ coordinates: initialCoordinates, zoom: initialZoom });
    setDotSize({ r: 5, w: 1 });
  }

  function handleMoveEnd(position: { coordinates: [number, number]; zoom: number }) {
    setPosition(position);

    handleDotSize(position.zoom);
  }

  const handleDotSize = (zoom: number) => {
    if (zoom < 3) {
      setDotSize({ r: 5, w: 1 });
    } else if (zoom < 5) {
      setDotSize({ r: 3, w: 0.8 });
    } else if (zoom < 6.5) {
      setDotSize({ r: 2, w: 0.5 });
    } else if (zoom <= maxZoom) {
      setDotSize({ r: 1.5, w: 0.2 });
    }
  };

  const handleZoomIn = () => {
    setPosition(prev => {
      const newZoom = Math.min(maxZoom, prev.zoom + 1);
      handleDotSize(newZoom);
      return { ...prev, zoom: newZoom };
    });
  };

  const handleZoomOut = () => {
    setPosition(prev => {
      const newZoom = Math.max(minZoom, prev.zoom - 1);
      handleDotSize(newZoom);
      return { ...prev, zoom: newZoom };
    });
  };

  return (
    <Box sx={{ position: "relative", display: "flex" }}>
      <Box
        sx={{ position: "absolute", padding: ".5rem", backgroundColor: `rgba(0,0,0,0.2)`, borderRadius: ".5rem", left: "50%", transform: "translateX(-50%)" }}
      >
        <IconButton onClick={handleZoomIn} disabled={position.zoom === maxZoom} color="secondary" size="small">
          <AddIcon />
        </IconButton>
        <IconButton onClick={handleZoomOut} disabled={position.zoom === minZoom} color="secondary" sx={{ marginLeft: ".5rem" }} size="small">
          <RemoveIcon />
        </IconButton>

        <IconButton onClick={() => resetZoom()} sx={{ marginLeft: ".5rem" }} disabled={isInitialPosition} size="small">
          <RestartAltIcon />
        </IconButton>
      </Box>
      <ComposableMap projectionConfig={{ rotate: [-10, 0, 0] }}>
        <ZoomableGroup
          zoom={position.zoom}
          center={position.coordinates}
          onMoveEnd={handleMoveEnd}
          filterZoomEvent={e => {
            if (e instanceof WheelEvent) {
              return false;
            }

            return true;
          }}
        >
          <Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json">
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={bgColor}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none" },
                    pressed: { outline: "none" }
                  }}
                />
              ))
            }
          </Geographies>
          {activeProviders.map(({ owner, name, ipLon, ipLat, ipRegion, ipCountryCode }) => {
            return (
              <Link key={owner} href={UrlService.providerDetail(owner)}>
                <Marker coordinates={[parseFloat(ipLon), parseFloat(ipLat)]}>
                  <CustomTooltip
                    title={
                      <Box>
                        <Box>{name}</Box>
                        <Box>
                          {ipRegion}, {ipCountryCode}
                        </Box>
                      </Box>
                    }
                  >
                    <circle className={classes.circle} fill={theme.palette.secondary.main} stroke="#FFF" strokeWidth={dotSize.w} r={dotSize.r} />
                  </CustomTooltip>
                </Marker>
              </Link>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>
    </Box>
  );
};
