import { useFragment, graphql } from "react-relay";
import {
  AllPokemon_display_details$data,
  AllPokemon_display_details$key,
} from "../__relay__generated__/AllPokemon_display_details.graphql";
import { FC } from "react";

// export interface AllPokemonProps {
//   pokemon: AllPokemon_display_details$data;
// }

const AllPokemonFragment = graphql`
  fragment AllPokemon_display_details on pokemon_pokemon_v2_pokemon {
    _id: id
    name
    pokemon_v2_pokemontypes {
      pokemon_v2_type {
        name
      }
    }
    pokemon_v2_pokemonabilities {
      pokemon_v2_ability {
        name
      }
    }
  }
`;

export const AllPokemon: FC = ({ pokemon }) => {
  const data = useFragment(AllPokemonFragment, pokemon);
  return (
    <div>
      <p>All My Pokemons!</p>
      <pre>{JSON.stringify(data)}</pre>
    </div>
  );
};
