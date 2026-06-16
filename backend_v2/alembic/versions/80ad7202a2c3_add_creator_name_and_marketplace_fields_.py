"""Add creator_name and marketplace fields to Course

Revision ID: 80ad7202a2c3
Revises: 28df309c135a
Create Date: 2026-06-16 07:12:29.521878

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite

# revision identifiers, used by Alembic.
revision: str = '80ad7202a2c3'
down_revision: Union[str, Sequence[str], None] = '28df309c135a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns to courses
    op.add_column('courses', sa.Column('creator_name', sa.String(), nullable=True))
    op.add_column('courses', sa.Column('institution', sa.String(), nullable=True))
    
    # Add column to videos
    op.add_column('videos', sa.Column('is_preview', sa.Boolean(), server_default='0', nullable=True))
    
    # Create learning_tracks table
    op.create_table(
        'learning_tracks',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('badge_name', sa.String(), nullable=True),
        sa.Column('is_published', sa.Boolean(), server_default='0', nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True)
    )

    # Create track_courses table
    op.create_table(
        'track_courses',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('track_id', sa.String(), nullable=True),
        sa.Column('course_id', sa.String(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=True)
    )
    op.create_index(op.f('ix_track_courses_course_id'), 'track_courses', ['course_id'], unique=False)
    op.create_index(op.f('ix_track_courses_track_id'), 'track_courses', ['track_id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_track_courses_track_id'), table_name='track_courses')
    op.drop_index(op.f('ix_track_courses_course_id'), table_name='track_courses')
    op.drop_table('track_courses')
    op.drop_table('learning_tracks')
    op.drop_column('videos', 'is_preview')
    op.drop_column('courses', 'institution')
    op.drop_column('courses', 'creator_name')
