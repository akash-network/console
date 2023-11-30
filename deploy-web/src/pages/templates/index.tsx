import { useState, useEffect } from "react";
import { Box, TextField, Typography, List, ListItemText, IconButton, ListItemButton, useTheme, Button, CircularProgress } from "@mui/material";
import { useTemplates } from "../../context/TemplatesProvider";
import CloseIcon from "@mui/icons-material/Close";
import { makeStyles } from "tss-react/mui";
import { useRouter } from "next/router";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "@src/components/layout/Layout";
import PageContainer from "@src/components/shared/PageContainer";
import { TemplateBox } from "@src/components/templates/TemplateBox";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import { LinkTo } from "@src/components/shared/LinkTo";
import { MobileTemplatesFilter } from "@src/components/templates/MobileTemplatesFilter";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import { CustomNextSeo } from "@src/components/shared/CustomNextSeo";

type Props = {};

const useStyles = makeStyles()(theme => ({
  gallery: {
    display: "flex"
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: "bold"
  },
  categoryList: {
    overflow: "auto",
    flexBasis: "280px"
  },
  templateList: {
    overflow: "auto",
    flexBasis: 0,
    flexGrow: 999,
    "& .MuiAvatar-img": {
      objectFit: "contain"
    }
  }
}));

let timeoutId = null;

const TemplateGalleryPage: React.FunctionComponent<Props> = ({}) => {
  const [selectedCategoryTitle, setSelectedCategoryTitle] = useState(null);
  const [searchTerms, setSearchTerms] = useState("");
  const [shownTemplates, setShownTemplates] = useState([]);
  const { isLoading: isLoadingTemplates, categories, templates } = useTemplates();
  const router = useRouter();
  const theme = useTheme();
  const { classes } = useStyles();
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  useEffect(() => {
    const queryCategory = router.query.category as string;
    const querySearch = router.query.search as string;

    if (queryCategory) {
      setSelectedCategoryTitle(queryCategory);
    }

    if (querySearch) {
      setSearchTerms(querySearch);
    }
  }, []);

  useEffect(() => {
    const queryCategory = router.query.category as string;
    const querySearch = router.query.search as string;
    let _templates = [];

    if (queryCategory) {
      const selectedCategory = categories.find(x => x.title === queryCategory);
      _templates = selectedCategory?.templates || [];
    } else {
      _templates = templates;
    }

    if (querySearch) {
      const searchTermsSplit = querySearch?.split(" ").map(x => x.toLowerCase());
      _templates = templates.filter(x => searchTermsSplit.some(s => x.name.toLowerCase().includes(s) || x.readme.toLowerCase().includes(s)));
    }

    setShownTemplates(_templates);

    return () => {
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query, templates]);

  const onSearchChange = event => {
    const searchValue = event.target.value;
    setSearchTerms(searchValue);

    if (searchValue) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        router.replace(UrlService.templates(selectedCategoryTitle, searchValue));
      }, 300);
    } else {
      router.replace(UrlService.templates(selectedCategoryTitle, ""));
    }
  };

  const onCategoryClick = categoryTitle => {
    setSelectedCategoryTitle(categoryTitle);

    if (isMobileSearchOpen) {
      setIsMobileSearchOpen(false);
    }
    router.replace(UrlService.templates(categoryTitle, searchTerms));
  };

  const onClearSearch = () => {
    setSearchTerms("");

    router.replace(UrlService.templates(selectedCategoryTitle, ""));
  };

  const searchBar = (
    <TextField
      fullWidth
      label="Search"
      size="small"
      sx={{ marginBottom: "1rem" }}
      disabled={isLoadingTemplates}
      value={searchTerms}
      onChange={onSearchChange}
      InputProps={{
        endAdornment: searchTerms && (
          <IconButton onClick={onClearSearch} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        )
      }}
    />
  );

  return (
    <Layout isLoading={isLoadingTemplates}>
      <CustomNextSeo
        title="Template Gallery"
        url={`https://console.akash.network${UrlService.templates()}`}
        description="Explore all the templates made by the community to easily deploy any docker container on the Akash Network."
      />

      <PageContainer>
        <Box sx={{ textAlign: "center", marginBottom: { xs: "1.5rem", sm: "2rem", md: "3rem" } }}>
          <Typography variant="h1" sx={{ fontSize: { xs: "1.5rem", sm: "2rem", md: "3rem" }, fontWeight: "bold", marginBottom: "1rem" }}>
            Find your Template
          </Typography>

          <Typography
            variant="h3"
            sx={{
              fontSize: { xs: "1rem", sm: "1.2rem", md: "1.5rem" },
              color: theme.palette.mode === "dark" ? theme.palette.grey[500] : theme.palette.grey[600]
            }}
          >
            Jumpstart your app development process with our pre-built solutions.
          </Typography>
        </Box>

        <Box sx={{ display: { xs: "block", sm: "block", md: "none" }, marginBottom: "1rem" }}>
          {searchBar}

          <Button onClick={() => setIsMobileSearchOpen(true)} fullWidth variant="outlined" color="primary" endIcon={<FilterAltIcon />}>
            Filter Templates
          </Button>
          <MobileTemplatesFilter
            handleDrawerToggle={() => setIsMobileSearchOpen(prev => !prev)}
            isOpen={isMobileSearchOpen}
            templates={templates}
            categories={categories}
            onCategoryClick={onCategoryClick}
            selectedCategoryTitle={selectedCategoryTitle}
          />

          {selectedCategoryTitle && !searchTerms && (
            <Typography variant="body1" sx={{ marginTop: "1rem", fontWeight: "bold" }}>
              {selectedCategoryTitle}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: "flex" }}>
          {templates.length > 0 && (
            <Box sx={{ width: "222px", marginRight: "3rem", display: { xs: "none", sm: "none", md: "block" } }}>
              <Typography variant="body1" sx={{ marginBottom: "1rem", fontWeight: "bold" }}>
                Filter Templates
              </Typography>

              {searchBar}

              <List>
                {templates && (
                  <ListItemButton onClick={() => onCategoryClick(null)} selected={!selectedCategoryTitle} sx={{ padding: "0 1rem" }} dense>
                    <ListItemText primary={`All (${templates.length - 1})`} />
                  </ListItemButton>
                )}

                {categories
                  .sort((a, b) => (a.title < b.title ? -1 : 1))
                  .map(category => (
                    <ListItemButton
                      key={category.title}
                      onClick={() => onCategoryClick(category.title)}
                      selected={category.title === selectedCategoryTitle}
                      sx={{ padding: "0 1rem" }}
                      dense
                    >
                      <ListItemText primary={`${category.title} (${category.templates.length})`} />
                    </ListItemButton>
                  ))}
              </List>
            </Box>
          )}

          <Box sx={{ flex: "1 1" }}>
            {searchTerms && (
              <Box sx={{ paddingBottom: "1rem", display: "flex", alignItems: "center" }}>
                <Typography variant="body2" color="textSecondary">
                  Searching for: "{searchTerms}" - {shownTemplates.length} results
                </Typography>

                <Box sx={{ marginLeft: "1rem", display: "inline-flex" }}>
                  <LinkTo onClick={onClearSearch}>Clear</LinkTo>
                </Box>
              </Box>
            )}

            <Box
              sx={{ gridTemplateColumns: { xs: "repeat(1,1fr)", sm: "repeat(2,1fr)", md: "repeat(2,1fr)", lg: "repeat(3,1fr)" }, display: "grid", gap: "1rem" }}
            >
              {shownTemplates.map((template, id) => (
                <TemplateBox key={`${template.id}_${id}`} template={template} />
              ))}
            </Box>

            {isLoadingTemplates && (
              <Box sx={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
                <CircularProgress color="secondary" size="3rem" />
              </Box>
            )}

            {!isLoadingTemplates && categories.length > 0 && shownTemplates.length === 0 && (!!searchTerms || !!selectedCategoryTitle) && (
              <Box
                sx={{
                  height: "200px",
                  border: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[500]}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column"
                }}
              >
                <SearchOffIcon sx={{ fontSize: "4rem", marginBottom: "1rem" }} />
                <Typography variant="body2">No search result found. Try adjusting your filters.</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </PageContainer>
    </Layout>
  );
};

export default TemplateGalleryPage;

export async function getServerSideProps({ params }) {
  return {
    props: {}
  };
}
