import { useState, Suspense, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import {
  PreloadedQuery,
  graphql,
  usePreloadedQuery,
  useQueryLoader,
} from "react-relay";
import viteLogo from "/vite.svg";
import "./App.css";
import { AppAllPokemonQuery as AppAllPokemonQueryType } from "./__relay__generated__/AppAllPokemonQuery.graphql";
import { AllPokemon } from "./components/AllPokemon";

const AllPokemonQuery = graphql`
  query AppAllPokemonQuery {
    pokemon_pokemon_v2_pokemon(limit: 30) {
      ...AllPokemon_display_details
    }
  }
`;

const MyComp = ({
  queryReference,
}: {
  queryReference: PreloadedQuery<
    AppAllPokemonQueryType,
    Record<string, unknown>
  >;
}) => {
  const data = usePreloadedQuery(AllPokemonQuery, queryReference);

  return (
    <div>
      <pre>{JSON.stringify(data)}</pre>
      {/* <AllPokemon pokemon={data.pokemon_pokemon_v2_pokemon} /> */}
    </div>
  );
};

function App() {
  const [count, setCount] = useState(0);
  const [queryReference, loadQuery] =
    useQueryLoader<AppAllPokemonQueryType>(AllPokemonQuery);

  useEffect(() => {
    loadQuery({});
  }, []);

  return (
    <div className="App">
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <Suspense fallback="Loading...">
        {queryReference && <MyComp queryReference={queryReference} />}
      </Suspense>
      {/* <AllPokemon pokemon={} /> */}
    </div>
  );
}

export default App;
