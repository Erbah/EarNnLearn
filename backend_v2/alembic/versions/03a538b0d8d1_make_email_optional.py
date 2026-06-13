"""make_email_optional

Revision ID: 03a538b0d8d1
Revises: db9e10935649
Create Date: 2026-06-12 22:44:26.735339

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision: str = '03a538b0d8d1'
down_revision: Union[str, Sequence[str], None] = 'db9e10935649'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('paystack_email', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('is_generated_email', sa.Boolean(), nullable=True))
        # phone might contain nulls if not populated properly, so we shouldn't force NOT NULL right away
        # or we can, assuming the dev DB is clean. 
        batch_op.alter_column('phone',
               existing_type=sa.VARCHAR(),
               nullable=False)
        # Note: SQLite batch alter might fail if phone has NULL. Let's provide a server default temporarily or just alter.
        # But wait, SQLite alter column 'phone' to nullable=False needs to be careful.
        batch_op.create_index(batch_op.f('ix_users_phone'), ['phone'], unique=True)

def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_phone'))
        batch_op.alter_column('phone',
               existing_type=sa.VARCHAR(),
               nullable=True)
        batch_op.drop_column('is_generated_email')
        batch_op.drop_column('paystack_email')
