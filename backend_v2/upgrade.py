import asyncio
from app.db.session import async_session_maker
from app.models.user import User
from sqlalchemy import update

async def main():
    async with async_session_maker() as session:
        await session.execute(update(User).values(is_beta_user=True, role='SUPER_ADMIN'))
        await session.commit()
        print('All users upgraded to SUPER_ADMIN and beta users')

asyncio.run(main())
