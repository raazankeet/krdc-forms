"""add_field_name_to_submission_comments

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-17 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'submission_comments',
        sa.Column('field_name', sa.String(255), nullable=True),
    )
    op.create_index(
        'ix_submission_comments_field_name',
        'submission_comments',
        ['field_name'],
    )


def downgrade() -> None:
    op.drop_index('ix_submission_comments_field_name', table_name='submission_comments')
    op.drop_column('submission_comments', 'field_name')
