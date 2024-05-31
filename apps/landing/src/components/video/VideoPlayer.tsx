import { ReactNode, useRef, useState } from "react";
import { Box, useTheme } from "@mui/material";
import ReactPlayer from "react-player/lazy";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import { animated, useSpring } from "@react-spring/web";

type Props = {
  url: string;
  children?: ReactNode;
};

export const VideoPlayer: React.FunctionComponent<Props> = ({ url }) => {
  const [isOver, setIsOver] = useState(false);
  const theme = useTheme();
  const videoRef = useRef<ReactPlayer>();
  const { x } = useSpring({
    from: { x: 0 },
    x: isOver ? 0 : 1,
    config: { duration: 200 }
  });

  const onClick = () => {
    videoRef.current?.seekTo(0);
  };

  return (
    <Box
      sx={{
        position: "relative",
        aspectRatio: "1.8/1",
        borderRadius: "1rem",
        overflow: "hidden"
      }}
      onMouseEnter={() => setIsOver(true)}
      onMouseLeave={() => setIsOver(false)}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }} display="flex" justifyContent="center">
        <ReactPlayer
          url={url}
          playsinline
          playing={isOver}
          loop
          style={{ backgroundColor: theme.palette.primary.dark }}
          width="100%"
          height="100%"
          ref={videoRef}
        />
      </Box>

      <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }} onClick={onClick}>
        <animated.div
          style={{
            opacity: x
          }}
        >
          <PlayCircleOutlineIcon sx={{ fontSize: "4rem", opacity: 0.7, color: theme.palette.primary.contrastText }} />
        </animated.div>
      </Box>
    </Box>
  );
};
