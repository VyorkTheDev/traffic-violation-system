import bcrypt
from app import app
from models import db, User, Vehicle


USERS = [
    {"username": "admin",          "email": "admin@traffic.gov.tr",       "password": "admin123", "role": "admin"},
    {"username": "ahmet.yilmaz",   "email": "ahmet.yilmaz@gmail.com",     "password": "sifre123", "role": "citizen"},
    {"username": "elif.kaya",      "email": "elif.kaya@gmail.com",        "password": "sifre123", "role": "citizen"},
    {"username": "mehmet.demir",   "email": "mehmet.demir@hotmail.com",   "password": "sifre123", "role": "citizen"},
    {"username": "zeynep.celik",   "email": "zeynep.celik@gmail.com",     "password": "sifre123", "role": "citizen"},
    {"username": "mustafa.sahin",  "email": "mustafa.sahin@yahoo.com",    "password": "sifre123", "role": "citizen"},
    {"username": "ayse.ozturk",    "email": "ayse.ozturk@gmail.com",      "password": "sifre123", "role": "citizen"},
    {"username": "emre.arslan",    "email": "emre.arslan@hotmail.com",    "password": "sifre123", "role": "police"},
    {"username": "fatma.yildiz",   "email": "fatma.yildiz@gmail.com",     "password": "sifre123", "role": "police"},
    {"username": "burak.koc",      "email": "burak.koc@gmail.com",        "password": "sifre123", "role": "citizen"},
    {"username": "selin.tas",      "email": "selin.tas@yahoo.com",        "password": "sifre123", "role": "citizen"},
]

VEHICLES = [
    {"plate": "34ABC123", "brand": "Toyota",     "model": "Corolla", "year": 2020, "owner": "ahmet.yilmaz"},
    {"plate": "06DEF456", "brand": "Honda",      "model": "Civic",   "year": 2019, "owner": "elif.kaya"},
    {"plate": "35GHI789", "brand": "Volkswagen", "model": "Passat",  "year": 2021, "owner": "mehmet.demir"},
    {"plate": "01JKL012", "brand": "Renault",    "model": "Megane",  "year": 2018, "owner": "zeynep.celik"},
    {"plate": "16MNO345", "brand": "Fiat",       "model": "Egea",    "year": 2022, "owner": "mustafa.sahin"},
    {"plate": "07PRS678", "brand": "Hyundai",    "model": "i20",     "year": 2020, "owner": "ayse.ozturk"},
    {"plate": "34TUV901", "brand": "BMW",        "model": "320i",    "year": 2023, "owner": "burak.koc"},
    {"plate": "42XYZZ34", "brand": "Mercedes",   "model": "C200",    "year": 2021, "owner": "selin.tas"},
    {"plate": "06ABC567", "brand": "Opel",       "model": "Astra",   "year": 2017, "owner": "ahmet.yilmaz"},
    {"plate": "34DEF890", "brand": "Peugeot",    "model": "308",     "year": 2019, "owner": "elif.kaya"},
]


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def seed():
    with app.app_context():
        print("Dropping all tables...")
        db.drop_all()
        print("Recreating all tables...")
        db.create_all()

        # Insert users
        user_map = {}
        for u in USERS:
            user = User(
                username=u["username"],
                email=u["email"],
                password=_hash(u["password"]),
                role=u["role"],
            )
            db.session.add(user)
        db.session.commit()

        # Build username -> id map after commit (IDs are now assigned)
        for user in User.query.all():
            user_map[user.username] = user.id

        # Insert vehicles
        for v in VEHICLES:
            vehicle = Vehicle(
                plate=v["plate"],
                brand=v["brand"],
                model=v["model"],
                year=v["year"],
                owner_id=user_map[v["owner"]],
            )
            db.session.add(vehicle)
        db.session.commit()

        user_count = User.query.count()
        vehicle_count = Vehicle.query.count()
        print(f"Seeded {user_count} users and {vehicle_count} vehicles successfully.")
        print()
        print("Credentials:")
        print("  admin         / admin123  (admin)")
        print("  emre.arslan   / sifre123  (police)")
        print("  fatma.yildiz  / sifre123  (police)")
        print("  ahmet.yilmaz  / sifre123  (citizen, 2 vehicles)")
        print("  elif.kaya     / sifre123  (citizen, 2 vehicles)")
        print("  [others]      / sifre123  (citizen, 1 vehicle each)")


if __name__ == "__main__":
    seed()
