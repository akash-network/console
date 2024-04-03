"use client";
import { ApiProviderList } from "@src/types/provider";
import { ComposableMap, Geographies, Geography, Marker, Point, ZoomableGroup } from "react-simple-maps";
import { useState } from "react";
import { CustomNoDivTooltip, CustomTooltip } from "../../components/shared/CustomTooltip";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { useTheme } from "next-themes";
import { Button } from "@src/components/ui/button";
import { Minus, Plus, Restart } from "iconoir-react";

// const useStyles = makeStyles()(theme => ({
//   circle: {
//     cursor: "pointer"
//   }
// }));

type Props = {
  initialZoom?: number;
  initialCoordinates?: Point;
  providers: ApiProviderList[];
};

const minZoom = 1;
const maxZoom = 8;

export const ProviderMap: React.FunctionComponent<Props> = ({ providers, initialZoom = minZoom, initialCoordinates = [0, 0] }) => {
  const [dotSize, setDotSize] = useState({ r: 5, w: 1 });
  const { theme } = useTheme();
  const activeProviders = providers.filter(x => x.isOnline);
  // const bgColor = theme === "dark" ? theme.palette.grey[800] : theme.palette.grey[400];
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
    <div className="relative flex">
      <div
        className="absolute left-1/2 -translate-x-1/2 transform rounded-md bg-black bg-opacity-20 p-2"
        // sx={{ position: "absolute", padding: ".5rem", backgroundColor: `rgba(0,0,0,0.2)`, borderRadius: ".5rem", left: "50%", transform: "translateX(-50%)" }}
      >
        <Button onClick={handleZoomIn} disabled={position.zoom === maxZoom} size="icon">
          <Plus />
        </Button>
        <Button onClick={handleZoomOut} disabled={position.zoom === minZoom} size="icon" className="ml-2">
          <Minus />
        </Button>

        <Button onClick={() => resetZoom()} disabled={isInitialPosition} size="icon" className="ml-2">
          <Restart />
        </Button>
      </div>
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
                  className="fill-muted-foreground"
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
                  <CustomNoDivTooltip
                    title={
                      <div>
                        <div className="text-lg">{name}</div>
                        <strong>
                          {ipRegion}, {ipCountryCode}
                        </strong>
                      </div>
                    }
                  >
                    <circle className="cursor-pointer fill-primary" stroke="#FFF" strokeWidth={dotSize.w} r={dotSize.r} />
                  </CustomNoDivTooltip>
                </Marker>
              </Link>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
};
