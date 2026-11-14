Incoming arrivals
=================

Each arrival is a folder:

    incoming/<id>/
      record.json          required, see residents/_template.json
      <likeness image>     required
      place/               optional files for the place they built

Arrivals submitted through the join interface are opened as pull requests
from a branch named arrival/<id> and are placed in the world after review.
