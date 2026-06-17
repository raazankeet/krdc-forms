"""add_role_to_form_assignments

Revision ID: a1b2c3d4e5f6
Revises: 5b9dc0f4ec84
Create Date: 2026-06-16 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '5b9dc0f4ec84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('form_assignments',
        sa.Column('role', sa.String(length=20), nullable=False, server_default='submitter')
    )


def downgrade() -> None:
    op.drop_column('form_assignments', 'role')
