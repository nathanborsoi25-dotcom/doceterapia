"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Banner = {
  bannerAtivo: boolean;
  bannerTitulo: string;
  bannerDescricao: string;
  bannerSelo: string;
  bannerImagem: string;
  bannerLink: string;
};

/**
 * Destaque de promoção no topo do cardápio. A Camily liga, desliga e edita
 * tudo pelo painel — o site só mostra o que ela deixou ativo.
 */
export default function BannerPromocao() {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    fetch("/api/config-loja", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setBanner)
      .catch(() => setBanner(null));
  }, []);

  if (!banner?.bannerAtivo || !banner.bannerTitulo) return null;

  return (
    <Link
      href={banner.bannerLink || "/catalogo"}
      className="block max-w-5xl mx-auto mb-8 bg-white/70 border border-cherryLight/40 rounded-cherry overflow-hidden hover:border-cherryDark transition-colors"
    >
      {banner.bannerImagem && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banner.bannerImagem}
          alt={banner.bannerTitulo}
          className="w-full h-40 sm:h-56 object-cover"
        />
      )}
      <div className="p-5 text-center">
        <h2 className="font-display text-xl sm:text-2xl text-cherryDark">
          {banner.bannerTitulo}
        </h2>
        {banner.bannerDescricao && (
          <p className="font-body text-sm text-ink/70 mt-2 max-w-md mx-auto">
            {banner.bannerDescricao}
          </p>
        )}
        {banner.bannerSelo && (
          <span className="inline-block mt-3 bg-cherryDark text-white text-xs font-body font-bold uppercase tracking-wide rounded-full px-4 py-2">
            {banner.bannerSelo}
          </span>
        )}
      </div>
    </Link>
  );
}
