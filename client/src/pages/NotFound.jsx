import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="page narrow">
      <h1>This room is empty</h1>
      <p>There is no page at this address. Check the link, or head back.</p>
      <p><Link className="btn btn-primary" to="/">Go to the start</Link></p>
    </section>
  );
}
