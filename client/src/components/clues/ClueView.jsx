import { clueShape } from '../game/gameShapes';
import TextClue from './TextClue';
import TokensClue from './TokensClue';
import TableClue from './TableClue';
import StripClue from './StripClue';
import SymbolsClue from './SymbolsClue';
import GridClue from './GridClue';

// Clue renderer composed by display type (PRD §6.3, §10.1 Unit II). `grid` arrived in Phase 3 (D40).
const RENDERERS = {
  text: TextClue,
  tokens: TokensClue,
  table: TableClue,
  strip: StripClue,
  symbols: SymbolsClue,
  grid: GridClue,
};

export default function ClueView({ clue }) {
  const Renderer = RENDERERS[clue.type];
  if (!Renderer) return <p className="form-note">This clue type is not supported yet.</p>;
  return <Renderer data={clue.data} />;
}

ClueView.propTypes = { clue: clueShape.isRequired };
