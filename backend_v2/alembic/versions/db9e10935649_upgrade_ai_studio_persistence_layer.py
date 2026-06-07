"""Upgrade AI Studio Persistence Layer

Revision ID: db9e10935649
Revises: 
Create Date: 2026-05-11 04:36:10.132435

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'db9e10935649'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create ai_assets table
    op.create_table('ai_assets',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('topic', sa.String(), nullable=False),
        sa.Column('subtopic', sa.String(), nullable=True),
        sa.Column('content_type', sa.String(), nullable=True),
        sa.Column('semantic_depth', sa.String(), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('extra_metadata', sa.JSON(), nullable=True),
        sa.Column('is_verified', sa.Boolean(), nullable=True),
        sa.Column('usage_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_assets_subtopic'), 'ai_assets', ['subtopic'], unique=False)
    op.create_index(op.f('ix_ai_assets_topic'), 'ai_assets', ['topic'], unique=False)

    # 2. Add columns to ai_lessons
    # (Skipped: columns already exist from previous partial migration attempt)

    # 3. Add columns to subject_roadmaps
    with op.batch_alter_table('subject_roadmaps') as batch_op:
        batch_op.add_column(sa.Column('is_public', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('is_verified', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('version', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('parent_id', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('usage_count', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('popularity_score', sa.Numeric(precision=10, scale=2), nullable=True))
        batch_op.add_column(sa.Column('tags', sa.JSON(), nullable=True))
        batch_op.create_index(op.f('ix_subject_roadmaps_is_public'), ['is_public'], unique=False)
        batch_op.create_index(op.f('ix_subject_roadmaps_is_verified'), ['is_verified'], unique=False)
        batch_op.create_index(op.f('ix_subject_roadmaps_parent_id'), ['parent_id'], unique=False)


def downgrade() -> None:
    op.drop_table('ai_assets')
    
    with op.batch_alter_table('ai_lessons') as batch_op:
        batch_op.drop_column('tags')
        batch_op.drop_column('popularity_score')
        batch_op.drop_column('usage_count')
        batch_op.drop_column('parent_id')
        batch_op.drop_column('version')
        batch_op.drop_column('is_verified')
        batch_op.drop_column('is_public')

    with op.batch_alter_table('subject_roadmaps') as batch_op:
        batch_op.drop_column('tags')
        batch_op.drop_column('popularity_score')
        batch_op.drop_column('usage_count')
        batch_op.drop_column('parent_id')
        batch_op.drop_column('version')
        batch_op.drop_column('is_verified')
        batch_op.drop_column('is_public')
