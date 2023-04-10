import { useFragment, graphql } from "react-relay";

export const AllPokemon = ({ pokemon }) => {
  const data = useFragment(
    graphql`
      fragment AllPokemon_display_details on pokemon_pokemon_v2_pokemon {
        id
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
    `,
    pokemon
  );
  return (
    <div>
      <p>All My Pokemons!</p>
    </div>
  );
};
