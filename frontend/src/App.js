import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import axios from "axios";
import { HOME } from "@/constants/testIds";
import ComfortShellPreview from "@/pages/ComfortShellPreview";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Home = () => {
  const helloWorldApi = async () => {
    try {
      const response = await axios.get(`${API}/`);
      console.log(response.data.message);
    } catch (e) {
      console.error(e, `errored out requesting / api`);
    }
  };

  useEffect(() => {
    helloWorldApi();
  }, []);

  return (
    <div>
      <header className="App-header">
        <a
          data-testid={HOME.emergentLink}
          className="App-link"
          href="https://emergent.sh"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="https://avatars.githubusercontent.com/in/1201222?s=120&u=2686cf91179bbafbc7a71bfbc43004cf9ae1acea&v=4" />
        </a>
        <p className="mt-5">Building something incredible ~!</p>
        <Link
          to="/phase-4c/shell-preview"
          data-testid="home-shell-preview-link"
          className="mt-6 rounded-full border border-teal-500/40 px-5 py-2 text-base text-teal-300 transition-colors hover:bg-teal-500/10"
        >
          Phase 4C — Comfort shell preview
        </Link>
      </header>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/phase-4c/shell-preview" element={<ComfortShellPreview />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
