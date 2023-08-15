export function getLogoFromPath(path: string) {
  return path in logos ? logoBaseUrl + logos[path] : null;
}

const logoBaseUrl = "https://storage.googleapis.com/akashlytics-deploy-public/template_logos/";
const logos = {
  "speedtest-cli": "speedtest-by-ookla.jpg",
  fast: "fast.svg",
  geekbench: "geekbench.png",
  librespeed: "librespeed.png",
  openspeedtest: "openspeedtest.jpg",
  agoric: "agoric.png",
  wordpress: "wordpress.png",
  drupal: "drupal.png",
  wikijs: "wikijs.svg",
  confluence: "confluence.svg",
  pgadmin4: "postgresql.png",
  postgres: "postgresql.png",
  mongoDB: "mongodb.jpg",
  adminer: "adminer.png",
  MySQL: "mysql.png",
  couchdb: "couchdb.svg",
  influxdb: "influxdb.svg",
  odoo: "odoo.svg",
  mattermost: "mattermost.svg",
  jenkins: "jenkins.svg",
  bitbucket: "bitbucket.svg",
  "azure-devops-agent": "azure-devops.webp",
  minecraft: "minecraft.png",
  tetris: "tetris.webp",
  tetris2: "tetris.webp",
  pacman: "pacman.png",
  supermario: "mario.png",
  minesweeper: "minesweeper.png",
  doom: "doom.jpg"
};
