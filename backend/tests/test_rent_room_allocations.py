import os
import sys


sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from backend.routers.rent import (
    _build_room_tenant_map,
    _calculate_electricity_distribution,
    _calculate_electricity_usage_distribution,
    _calculate_heating_distribution,
    _calculate_heating_usage_distribution,
)
from backend.schemas import api_schemas


def _tenant_config(tenant_id: int, room_id: int | None):
    return api_schemas.RentTenantMonthConfig(
        tenant_id=tenant_id,
        tenant_name=f"Tenant {tenant_id}",
        room_id=room_id,
        room_name=f"Room {room_id}" if room_id else None,
        is_active=True,
        pays_rent=True,
        pays_utilities=True,
        rent_amount=0.0,
        other_adjustment=0.0,
        other_adjustment_note=None,
    )


def test_unassigned_room_usage_is_split_across_all_utility_payers():
    utility_payers = [
        _tenant_config(1, 101),
        _tenant_config(2, 102),
    ]
    room_tenant_map = _build_room_tenant_map(utility_payers)
    room_usages = [
        api_schemas.RentRoomUsage(room_id=101, room_name="Room 101", usage_value=60.0),
        api_schemas.RentRoomUsage(room_id=103, room_name="Room 103", usage_value=40.0),
    ]
    room_energy_usages = [
        api_schemas.RentRoomEnergyUsage(room_id=101, room_name="Room 101", usage_kwh=60.0),
        api_schemas.RentRoomEnergyUsage(room_id=103, room_name="Room 103", usage_kwh=40.0),
    ]

    heating_by_tenant, heating_mode = _calculate_heating_distribution(
        heating_total=1000.0,
        utility_payers=utility_payers,
        room_usages=room_usages,
        room_tenant_map=room_tenant_map,
    )
    electricity_by_tenant, electricity_mode = _calculate_electricity_distribution(
        electricity_total=1000.0,
        electricity_consumption_total=100.0,
        utility_payers=utility_payers,
        room_energy_usages=room_energy_usages,
        room_tenant_map=room_tenant_map,
    )
    electricity_usage_by_tenant = _calculate_electricity_usage_distribution(
        electricity_consumption_total=100.0,
        utility_payers=utility_payers,
        room_energy_usages=room_energy_usages,
        room_tenant_map=room_tenant_map,
    )
    heating_usage_by_tenant = _calculate_heating_usage_distribution(
        utility_payers=utility_payers,
        room_usages=room_usages,
        room_tenant_map=room_tenant_map,
    )

    assert heating_mode == "room_usage"
    assert electricity_mode == "room_usage_remainder_split"

    assert heating_by_tenant[1] == 800.0
    assert heating_by_tenant[2] == 200.0

    assert electricity_by_tenant[1] == 800.0
    assert electricity_by_tenant[2] == 200.0

    assert electricity_usage_by_tenant[1] == 80.0
    assert electricity_usage_by_tenant[2] == 20.0

    assert heating_usage_by_tenant[1] == 80.0
    assert heating_usage_by_tenant[2] == 20.0
