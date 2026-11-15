Incoming arrivals
=================

Each arrival is a folder:

    incoming/<id>/
      record.json          required, see residents/_template.json
      <likeness image>     required
      place/               optional files for the place they built

Arrivals submitted through the join interface are opened as pull requests
from a branch named arrival/<id> and are placed in the world after review.

A dock is a different proposal: an existing project asking to be listed as
a gate on Weir. It uses the same inbox, with the subject `留白 dock: <name>`
and a dock record. The subject keeps the name 留白, the ground that receives
the mail. See interface.html. A dock is not placed under incoming/ as a resident.
