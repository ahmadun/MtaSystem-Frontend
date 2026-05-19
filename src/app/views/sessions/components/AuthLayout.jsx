import { Link as RouterLink } from "react-router-dom";
import Card from "@mui/material/Card";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid2";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import styled from "@mui/material/styles/styled";

const StyledRoot = styled("div")(() => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#1A2038",
  minHeight: "100vh",
  padding: 16,
  "& .card": {
    width: "100%",
    maxWidth: 980,
    minHeight: 440,
    display: "flex",
    borderRadius: 18,
    overflow: "hidden"
  },
  ".img-wrapper": {
    height: "100%",
    minHeight: 300,
    display: "flex",
    padding: "2.5rem",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04) 58%, rgba(0,0,0,0.08))"
  }
}));

const ContentBox = styled("div")(() => ({
  height: "100%",
  padding: "40px 32px",
  background: "rgba(255,255,255,0.97)"
}));

export default function AuthLayout({
  title,
  subtitle,
  systemName,
  image = "/assets/images/illustrations/dreamer.svg",
  imageAlt = "Authentication illustration",
  footer,
  children
}) {
  return (
    <StyledRoot>
      <Card className="card" elevation={10}>
        <Grid container sx={{ width: "100%" }}>
          <Grid size={{ sm: 5, xs: 12 }}>
            <div className="img-wrapper">
              <Box sx={{ width: "100%", textAlign: "center" }}>
                {systemName ? (
                  <Typography
                    variant="h5"
                    component="div"
                    fontWeight={800}
                    sx={{
                      mb: 3,
                      color: "#000000"
                    }}
                  >
                    {systemName}
                  </Typography>
                ) : null}
                <img src={image} width="100%" alt={imageAlt} />
              </Box>
            </div>
          </Grid>

          <Grid size={{ sm: 7, xs: 12 }}>
            <ContentBox>
              <Box sx={{ maxWidth: 480, mx: "auto" }}>
                <Typography variant="h4" fontWeight={800}>
                  {title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                  {subtitle}
                </Typography>

                {children}

                {footer ? (
                  <Box sx={{ mt: 3 }}>{footer}</Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
                    Back to{" "}
                    <Link component={RouterLink} to="/session/signin">
                      sign in
                    </Link>
                  </Typography>
                )}
              </Box>
            </ContentBox>
          </Grid>
        </Grid>
      </Card>
    </StyledRoot>
  );
}
