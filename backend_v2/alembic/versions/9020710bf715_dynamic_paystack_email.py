"""dynamic_paystack_email

Revision ID: 9020710bf715
Revises: 03a538b0d8d1
Create Date: 2026-06-12 23:02:05.212327

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision: str = '9020710bf715'
down_revision: Union[str, Sequence[str], None] = '03a538b0d8d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.alter_column('phone',
               existing_type=sa.VARCHAR(),
               nullable=True)
        batch_op.drop_column('paystack_email')
        batch_op.drop_column('is_generated_email')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_generated_email', sa.BOOLEAN(), nullable=True))
        batch_op.add_column(sa.Column('paystack_email', sa.VARCHAR(), nullable=True))
        batch_op.alter_column('phone',
               existing_type=sa.VARCHAR(),
               nullable=False)
