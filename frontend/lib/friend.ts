const API = process.env.NEXT_PUBLIC_API_URL;

export async function getFriends(pid: string) {
  const res = await fetch(`${API}/friends/${pid}`, {
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load friends");
  }

  return data.friends;
}

export async function getPending(pid: string) {
  const res = await fetch(`${API}/friends/pending/${pid}`, {
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? "Failed to load pending requests");
  }

  return data.requests;
}

export async function sendRequest(
  from: string,
  to: string
) {
  const res = await fetch(`${API}/friends/request`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? "Failed to send request");
  }

  return data;
}

export async function acceptRequest(
  from: string,
  to: string
) {
  const res = await fetch(`${API}/friends/accept`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? "Failed to accept request");
  }

  return data;
}

export async function blockFriend(
  from: string,
  to: string
) {
  const res = await fetch(`${API}/friends/block`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? "Failed to block friend");
  }

  return data;
}

export async function removeFriend(
  from: string,
  to: string
) {
  const res = await fetch(`${API}/friends`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? "Failed to remove friend");
  }

  return data;
}